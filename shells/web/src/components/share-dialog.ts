// SPDX-License-Identifier: MPL-2.0
import { partitionShareParts, type PersonalShareField, type SharePrivacyInput } from '../lib/share-privacy.ts';
/**
 * The Share-link dialog - a ready-to-copy link plus toggles for the on-visit behaviour
 * flags (fullscreen / export panel / auto-download / copy-on-visit / pin-version) and an
 * optional "Shortest link" pack. Extracted from views/tool.js so it can be invoked from
 * anywhere that has a tool id + serialised state - the tool view's Share button AND the
 * Projects view's per-session "Share link" action (which reconstructs the state from a
 * saved session via createRuntime → serializeUrlState).
 *
 * Callers pass the ALREADY-BUILT query parts (tool inputs + optional export settings) and
 * the tool's manifest; this module only assembles the URL, renders the dialog, and copies.
 */
import { escape } from '../utils.ts';
import { bumpMetric } from '../metrics.ts';
import { announce } from '../a11y.ts';
import { packQuery, unpackToken, isPackAvailable, PACK_PARAM, packEncrypted, isEncryptAvailable, ENC_PARAM } from '@lolly/engine';
import { mountModal } from './modal.ts';
import { createShareSection } from './share-section.ts';
import { helpTip, linkHelpDescriptions, unwireHelpTips, wireHelpTips } from './help-tip.ts';
import { icon } from '../lib/icons.ts';
import { t } from '../i18n.ts';
import {
  mountShareSection, shareSectionBuilders, shareSectionOrder, shareSectionPlacement,
  type ShareSectionContext, type ShareSectionPlacement,
} from '../lib/share-sections.ts';
import { jellyActive } from '../lib/jelly.ts';
import type { LollySummary } from '../lib/lolly-pack.ts';
import { AUTO_PACK_MIN, SHARE_WARN_LEN, BROWSER_HARD_CAP, type ShareFidelity } from '../lib/url-budget.ts';
import { toLollyAppLink } from '../lib/deep-link.ts';
import { appPathname } from '../lib/any-site.ts';

/** The `.lolly` download vehicle (plans/114 Wave 2). Supplied by the tool view, which
 *  has the host + session the link builder never sees. `build(includeLicensed)` returns
 *  the file + a summary of what it carries; `save` delivers it (download / native share). */
export interface ShareDialogLolly {
  build: (opts?: { includeLicensed?: boolean; includeTool?: boolean }) => Promise<{ blob: Blob; filename: string; summary: LollySummary }>;
  save: (blob: Blob, filename: string) => Promise<void>;
  /** Hand the built file to the OS share sheet (Web Share / AirDrop / Android share).
   *  Resolves false when there's no share target, so the caller falls back to save().
   *  Present only when the host exposes `export.share` - the "Send to…" button is
   *  feature-detected off it. */
  share?: (blob: Blob, filename: string) => Promise<boolean>;
  /** The "include the tool" offer (plans/114 Wave 7): resolved lazily after the dialog
   *  opens, so a `custom` tool defaults the toggle on. When present, the File panel shows
   *  an "Include the tool" checkbox whose state feeds `build({ includeTool })`. */
  toolOffer?: () => Promise<{ trust: 'signed-catalog' | 'custom'; suggested: boolean }>;
}

// AUTO_PACK_MIN (auto-adopt the packed form), SHARE_WARN_LEN (call the link "long") and
// BROWSER_HARD_CAP (escalate to the .lolly) are imported from lib/url-budget.ts - the cost
// model owns those thresholds so the gauge, the dialog and syncUrl can never disagree on
// where the ceiling is. Modern browsers accept far more than the old ~2000 guess in both
// the address bar and on reopen, so SHARE_WARN_LEN is a comfort nudge (turn on "Shortest
// link"); only past BROWSER_HARD_CAP is even a packed link impractical to pass around, and
// there the verdict points at the .lolly file, whose manifest reports exactly
// what is embedded and what still has to resolve by reference.

// Bitmap formats copy to the clipboard as a PNG; text/html copy as text/rich text.
// Vector (svg/pdf) and video formats have no useful clipboard form, so the
// "copy on visit" toggle is hidden for them. Mirrors performCopy()'s branches.
const SHARE_BITMAP_FORMATS = new Set(['png', 'jpg', 'jpeg', 'webp', 'avif']);
const SHARE_TEXT_FORMATS   = new Set(['txt', 'md', 'markdown', 'html']);

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const previousFocus = document.activeElement as HTMLElement | null;
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    Object.assign(ta.style, { position: 'fixed', opacity: '0', pointerEvents: 'none' });
    document.body.appendChild(ta);
    try {
      ta.select();
      if (!document.execCommand?.('copy')) throw new Error(t('Could not copy to the clipboard.'));
    } finally {
      ta.remove();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    }
  }
}

// Assemble a full shareable URL from query parts. For a tool we emit the crawler-visible
// PATH form (/t/<id>) - the fragment is never sent to the server, so social crawlers only
// ever saw the generic og.png; /t/<id> is the per-tool OG stub that redirects a human back
// into the SPA with these params. `toolId` is passed explicitly (the tool view resolves it
// from location; the Projects session-share passes the saved session's toolId); if absent,
// fall back to the current location.
function shareUrlFromParts(parts: readonly string[], toolId?: string): string {
  const qs = parts.join('&');
  const query = qs ? '?' + qs : '';
  // A packaged Tauri page lives at http://tauri.localhost, which is an internal
  // WebView origin and not a link another person can open. Native Lolly shares
  // use the public address; the installed-app toggle below can then map that
  // canonical address to lolly:// without maintaining a second URL grammar.
  const native = !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  const origin = native ? 'https://lolly.tools' : window.location.origin;
  const id = toolId
    ?? window.location.pathname.match(/^\/t\/([^/?]+)/)?.[1]
    ?? window.location.hash.match(/^#\/tool\/([^/?]+)/)?.[1];
  if (id) return `${origin}/t/${id}${query}`;
  // A link is for someone else, so it never carries this device's `/any-site/` shell.
  return origin + appPathname() + window.location.hash.split('?')[0] + query;
}

/** An input field (top-level, or a `blocks` sub-field) - we only need its type. */
interface ShareInput extends SharePrivacyInput {
  type?: string;
  fields?: readonly { type?: string }[];
}

/** The manifest slice that drives which share toggles + notes are offered. */
interface ShareManifest {
  version?: string | number;
  render?: {
    export?: boolean;
    formats?: readonly string[];
    actions?: readonly unknown[];
  };
  inputs?: readonly ShareInput[];
}

// Input types that carry a user image. Catalog assets serialise as a shared ref,
// but a device-local image (an upload, or one from the picker's saved/library
// tabs) is bytes in this browser - it can't ride in a URL, so the recipient never
// gets it. When a tool declares one of these, the Share dialog says so.
const IMAGE_INPUT_TYPES = new Set(['asset', 'file']);
function hasImageInput(manifest: ShareManifest): boolean {
  return (manifest.inputs ?? []).some(inp =>
    IMAGE_INPUT_TYPES.has(inp.type ?? '') ||
    (inp.type === 'blocks' && (inp.fields ?? []).some(f => IMAGE_INPUT_TYPES.has(f.type ?? ''))),
  );
}

/**
 * What the current state loses when squeezed into a URL. `buildShareParams` (the
 * link builder) fills this in as it drops the things a link cannot carry, so the
 * dialog can tell the user *what* won't travel instead of handing them a link that
 * silently opens with the content missing (the reported "the link has no content"
 * bug). Content loss is distinct from length: a long link may still be faithful
 * (packing rescues it); an unfaithful one drops images/text no matter how short.
 */
// The report now lives with the cost model that produces it (lib/url-budget.ts) - 
// it is a projection of the costed params. Re-exported here so existing importers of
// the dialog keep working (imported at the top for local use).
export type { ShareFidelity };

/** Human list, no Oxford comma (house i18n style): "a", "a and b", "a, b and c". */
function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Plain-language summary of what a link had to drop, for the fidelity verdict. */
function describeLoss(f: ShareFidelity): string {
  const bits: string[] = [];
  const imgs = f.excludedAssets.length;
  if (imgs) bits.push(imgs === 1 ? 'an image or file added from this device' : `${imgs} images or files added from this device`);
  const texts = f.droppedScalars.length;
  if (texts) bits.push(texts === 1 ? 'a long text value' : `${texts} long text values`);
  const blocks = f.droppedBlocks.length;
  if (blocks) bits.push(blocks === 1 ? 'a large list' : `${blocks} large lists`);
  return joinList(bits);
}

export interface ShareDialogOpts {
  /** the tool this link opens */
  toolId?: string;
  /** query parts (tool inputs + optional export settings) */
  baseParts?: readonly string[];
  /** Locally reviewed values that require an explicit choice before entering a link. */
  personalFields?: readonly PersonalShareField[];
  /** the tool manifest (drives which toggles are offered) */
  manifest?: ShareManifest;
  /** the export format the link should imply (for copy-on-visit) */
  currentFormat?: string;
  /** dialog heading */
  title?: string;
  onClose?: () => void;
  /**
   * What the link can't carry (from `buildShareParams`). When supplied, the dialog
   * shows a content-loss verdict naming the drops; when omitted (e.g. the Projects
   * per-session share, which can't measure them), it falls back to the static
   * image note driven by the manifest.
   */
  fidelity?: ShareFidelity;
  /**
   * The `.lolly` file vehicle. When supplied, the dialog offers "Download .lolly" - 
   * the faithful fallback a link can't be (device-local images, big designs). The
   * content-loss verdict points here.
   */
  lolly?: ShareDialogLolly;
  /** Reads the live document for registered sections (lib/share-sections.ts). The
   *  dialog itself never reads the document. */
  document?: ShareSectionContext['document'];
}

/**
 * Open the Share dialog.
 * @param {object} o
 * @param {string} o.toolId        the tool this link opens
 * @param {string[]} o.baseParts   query parts (tool inputs + optional export settings)
 * @param {object} o.manifest      the tool manifest (drives which toggles are offered)
 * @param {string} [o.currentFormat] the export format the link should imply (for copy-on-visit)
 * @param {string} [o.title]       dialog heading
 */
export function openShareDialog(opts: ShareDialogOpts): HTMLDialogElement {
  const dialog = renderShareSurface(opts, content => mountModal<void>(content, {
    className: 'share-dialog',
    onClose: () => { unwireHelpTips(dialog); opts.onClose?.(); },
  }), true) as HTMLDialogElement;
  return dialog;
}

const panelSectionStates = new WeakMap<HTMLElement, Map<string, boolean>>();

function rememberSectionStates(surface: HTMLElement, states: Map<string, boolean>): void {
  for (const section of surface.querySelectorAll<HTMLDetailsElement>('details[data-share-section]')) {
    states.set(section.dataset.shareSection!, section.open);
  }
}

function restoreSectionStates(surface: HTMLElement, states?: Map<string, boolean>): void {
  if (!states) return;
  const sections = [...surface.querySelectorAll<HTMLDetailsElement>('details[data-share-section]')];
  if (surface.matches('details[data-share-section]')) sections.unshift(surface as HTMLDetailsElement);
  for (const section of sections) {
    const open = states.get(section.dataset.shareSection!);
    if (open !== undefined) section.open = open;
  }
}

function shareSectionHtml(title: string, iconName: string, className: string, content: string, dataName: string): string {
  const { section, body } = createShareSection(title, iconName, { className });
  section.setAttribute(dataName, '');
  // Only shell-authored markup from this module, with dynamic values escaped, belongs here.
  body.innerHTML = content;
  return section.outerHTML;
}

/** The same controls in a docked panel, without a second modal or focus theft. */
export function mountSharePanel(container: HTMLElement, opts: ShareDialogOpts, onClose?: () => void): () => void {
  const previous = container.querySelector<HTMLElement>(':scope > .export-share-surface');
  if (previous) unwireHelpTips(previous);
  const states = panelSectionStates.get(container) ?? new Map<string, boolean>();
  panelSectionStates.set(container, states);
  const surface = renderShareSurface(opts, content => {
    const el = document.createElement('div');
    el.className = 'export-share-surface';
    el.innerHTML = content;
    container.replaceChildren(el);
    return { el, close: () => { unwireHelpTips(el); if (onClose) onClose(); else el.remove(); } };
  }, false, states);
  return () => { rememberSectionStates(surface, states); unwireHelpTips(surface); surface.remove(); };
}

/** Keep the checkbox label separate from its info button. */
function shareOption(title: string, control: string, description: string, attributes = '', link?: { href: string; text: string }): string {
  const tip = helpTip(t(description), link);
  return `<div class="share-option help-tip-host" ${attributes}><label class="field-toggle">${control}<span>${escape(t(title))}</span></label>${tip.button}${tip.pop}</div>`;
}

function renderShareSurface(
  { toolId, baseParts: initialParts = [], personalFields = [], manifest = {}, currentFormat = '', title = 'Share this tool', fidelity, lolly, document: readDocument }: ShareDialogOpts,
  mount: (content: string) => { el: HTMLElement; close(): void },
  autofocus: boolean,
  sectionStates?: Map<string, boolean>,
): HTMLElement {
  // The readable query we'd pack (tool state + export settings) - WITHOUT the on-visit
  // flags, which stay readable outside the pack and merge on load.
  const partition = partitionShareParts(initialParts, manifest.inputs ?? []);
  const baseParts = partition.publicParts.slice();
  const publicParts = baseParts.slice();
  const personal = [...new Map([...partition.personal, ...personalFields].map(field => [field.id, field])).values()];
  let baseQuery = baseParts.join('&');

  // Only offer toggles the tool can actually honour.
  const canExport  = manifest.render?.export !== false && (manifest.render?.formats?.length ?? 0) > 0;
  const actions    = manifest.render?.actions ?? ['copy', 'download', 'save'];
  const currentFmt = currentFormat || manifest.render?.formats?.[0] || '';
  const isBitmap   = SHARE_BITMAP_FORMATS.has(currentFmt);
  const showCopy   = canExport && actions.includes('copy') && (isBitmap || SHARE_TEXT_FORMATS.has(currentFmt));
  const copyLabel  = isBitmap ? 'Copy image to clipboard on visit' : 'Copy to clipboard on visit';
  const version    = manifest.version;
  // When the caller supplies a fidelity report (the live tool view), the verdict
  // banner below names exactly what won't travel - so the generic manifest note is
  // redundant and doubly-noisy. Keep the static note only for callers without one
  // (the Projects per-session share reconstructs state and can't measure the drops).
  const showImageNote = hasImageInput(manifest) && !fidelity;
  // Offer password-protection only when there's state to encrypt and WebCrypto is present.
  const encryptable = isEncryptAvailable() && (!!baseQuery || personal.length > 0);
  // A tool's canonical /t/<id> share URL always has an installed-app twin. Keep
  // this checked through the same allowlisted converter the native intake uses;
  // a fallback/non-Lolly caller never gets offered a scheme link it cannot open.
  const appLinkable = !!toLollyAppLink(shareUrlFromParts(baseParts, toolId));
  const fileTip = helpTip(t('A .lolly file carries the saved design and files Lolly can include. Prepare the file to see its size, included files and external references.'));
  const content = `
    <div class="share-dialog-body">
      <h2>${escape(title)}</h2>
      <div class="share-link-row">
        <input type="text" class="share-link-field" readonly aria-label="Shareable link">
        ${jellyActive()
          // Keep the class: the copy handler selects by it, and the unlayered
          // jelly bridge reset (lib/jelly.ts) already strips its layered fill so
          // there's no second box behind the capsule. Accent = the row's action.
          ? `<jelly-button class="share-copy-btn" label="Copy">Copy</jelly-button>`
          : `<button type="button" class="share-copy-btn">Copy</button>`}
        ${/* The poster loop (plans/143 M3): one click from a share link to a
            printable QR of it, made with Lolly's own QR tool. Rendered only
            when this catalogue actually has qr-code. */
          (window.__toolIndex?.tools ?? []).some(t => t.id === 'qr-code')
            ? `<button type="button" class="btn share-qr-btn" title="${escape('Open the QR Code tool with this link - for posters, slides and print')}">QR</button>` : ''}
      </div>
      ${personal.length ? `<fieldset class="share-personal-review"><legend>Review personal fields</legend>
        <p>These values stay out of the link unless you select them. Anyone with the link can read included values. Shortening a link does not hide its contents.</p>
        ${personal.map((field, index) => `<label><input type="checkbox" data-personal-field="${index}"> Include ${escape(field.label)}</label><textarea readonly aria-label="${escape(field.label)} value" rows="3">${escape(field.value)}</textarea>`).join('')}
      </fieldset>` : ''}
      <p class="share-warning" data-share-warning role="status" hidden></p>
      ${showImageNote ? `<p class="share-note">
        <span class="share-note-ico" aria-hidden="true">${icon('plane', { size: 18 })}</span>
        <span>${escape(t('Images and files added from this device stay here. Share them separately.'))}</span>
      </p>` : ''}
      ${lolly ? shareSectionHtml(t('Editable file'), 'package', 'share-file-section', `<div class="share-file">
        <div class="share-file-btns help-tip-host">
          ${jellyActive()
            ? `<jelly-button class="share-file-btn" data-lolly-download aria-describedby="${fileTip.id}" label="Download .lolly">Download .lolly</jelly-button>`
            : `<button type="button" class="btn share-file-btn" data-lolly-download aria-describedby="${fileTip.id}">Download .lolly</button>`}
          ${lolly.share
            ? (jellyActive()
                ? `<jelly-button class="share-file-btn" data-lolly-share label="Send to…">Send to…</jelly-button>`
                : `<button type="button" class="btn share-file-btn" data-lolly-share>Send to…</button>`)
            : ''}
          ${fileTip.button}${fileTip.pop}
        </div>
        <span class="share-file-note" data-lolly-summary hidden></span>
        ${lolly.toolOffer ? shareOption('Include the tool', '<input type="checkbox" class="field-check" data-lolly-tool>', 'Lets the file open on devices without this tool or its catalog.', 'data-lolly-tool-wrap hidden') : ''}
        <div class="share-file-licensed" data-lolly-licensed hidden></div>
      </div>`, 'data-share-file') : ''}
      ${shareSectionHtml(t('Link options'), 'link', 'share-link-options', `
          ${appLinkable ? shareOption('Open in the installed app', '<input type="checkbox" class="field-check" data-app-link>', 'The recipient needs Lolly installed to open this link.', 'data-app-link-row', { href: '/info/build/url-mode.html#the-lolly-scheme', text: t('URI guide') }) : ''}
          ${shareOption('Shortest link', '<input type="checkbox" class="field-check" data-shortest>', 'Compresses the link while keeping the same inputs and settings.', 'data-shortest-row hidden')}
          ${encryptable ? `
          ${shareOption('Password-protect this link', '<input type="checkbox" class="field-check" data-encrypt>', 'Encrypts the link on this device. The recipient needs your password to open the saved inputs and settings.', 'data-encrypt-row')}
          <div class="share-password" data-encrypt-body hidden>
            <input type="password" class="field-input" data-encrypt-pw aria-label="Password to protect this link" autocomplete="off" spellcheck="false" placeholder="Set a password">
            <span class="share-shortest-note">${escape(t('Share the password separately. It cannot be recovered if lost.'))}</span>
          </div>` : ''}
          ${version ? `<label class="share-toggle-row field-toggle"><input type="checkbox" class="field-check" data-flag="_v"> Pin this tool version (${escape(String(version))})</label>` : ''}
        <fieldset class="share-toggles" data-link-behaviour>
          <legend>When the recipient opens the link…</legend>
          ${canExport
            ? '<label class="field-toggle"><input type="checkbox" class="field-check" data-flag="full"> Open in fullscreen (hide controls)</label>'
            /* A no-export tool's link IS the product (a jump page, a countdown), so
               it defaults to opening as a plain webpage - the visitor-page mode
               `?nostage` (views/tool.ts). Untick to send an editing link instead. */
            : '<label class="field-toggle"><input type="checkbox" class="field-check" data-flag="nostage" checked> Open as a web page (no controls)</label>'}
          <label class="field-toggle" data-options-row><input type="checkbox" class="field-check" data-flag="options"> Open with the export panel expanded</label>
          ${canExport ? `<label class="field-toggle"><input type="checkbox" class="field-check" data-flag="export"> Download automatically when opened</label>` : ''}
          ${showCopy ? `<label class="field-toggle"><input type="checkbox" class="field-check" data-flag="copy"> ${escape(copyLabel)}</label>` : ''}
        </fieldset>
        ${/* V2 (plans/143, Andy: "lolly is part of the composite art of any
            work"): the OPT-IN visible half of attribution. The credential layer
            always records Lolly; this row lets a sharer carry the credit into a
            caption with one click - never embedded into the artwork itself. */''}
        <p class="share-credit-row">
          <span>Made with Lolly · lolly.tools</span>
          <button type="button" class="btn btn--sm share-credit-btn" title="${escape('Copy a caption crediting Lolly, with this link')}">Copy credit</button>
        </p>`, 'data-link-options')}
      <div class="share-extra-sections" data-extra-sections></div>
      <div class="share-dialog-actions">
        ${jellyActive()
          ? `<jelly-button variant="platinum" class="share-done" label="Done">Done</jelly-button>`
          : `<button type="button" class="share-done">Done</button>`}
      </div>
    </div>
  `;
  const modal = mount(content);
  const dialog = modal.el;
  wireHelpTips(dialog);
  linkHelpDescriptions(dialog);
  const states = sectionStates ?? new Map<string, boolean>();
  restoreSectionStates(dialog, states);
  dialog.addEventListener('toggle', event => {
    const section = event.target as HTMLDetailsElement;
    if (section.tagName === 'DETAILS' && section.dataset.shareSection) states.set(section.dataset.shareSection, section.open);
  }, true);

  const field       = dialog.querySelector<HTMLInputElement>('.share-link-field')!;
  const fullCb      = dialog.querySelector<HTMLInputElement>('[data-flag="full"]');
  const optionsCb   = dialog.querySelector<HTMLInputElement>('[data-flag="options"]');
  const optionsRow  = dialog.querySelector<HTMLElement>('[data-options-row]');
  // On-visit flags and pin-version share the Link options disclosure.
  const checkboxes  = [...dialog.querySelectorAll<HTMLInputElement>('input[data-flag]')];
  const shortestRow = dialog.querySelector<HTMLElement>('[data-shortest-row]')!;
  const shortestCb  = dialog.querySelector<HTMLInputElement>('[data-shortest]')!;
  const appLinkCb   = dialog.querySelector<HTMLInputElement>('[data-app-link]');
  const warnEl      = dialog.querySelector<HTMLElement>('[data-share-warning]')!;
  // Packed token for the current state - filled in async once we know it helps.
  let packedToken: string | null = null;
  // Encrypted (`zx`) token for the current state + typed password - recomputed as the
  // password changes; null when protection is off or no password is set yet.
  const encryptCb   = dialog.querySelector<HTMLInputElement>('[data-encrypt]');
  const encryptBody = dialog.querySelector<HTMLElement>('[data-encrypt-body]');
  const encryptPw   = dialog.querySelector<HTMLInputElement>('[data-encrypt-pw]');
  const copyBtn     = dialog.querySelector<HTMLButtonElement>('.share-copy-btn')!;
  let encToken: string | null = null;

  // The share verdict combines the two independent ways a link can fail its job.
  // CONTENT loss (fidelity: device-local images, or text/blocks past the link caps
  // that a URL cannot hold) is the worse failure - packing can rescue length, but
  // nothing rescues a dropped image - so it wins the banner and reads red. Otherwise
  // an over-LONG link reads amber. `bestLen` is the shortest achievable length (the
  // packed length once known, else readable), so length is judged on the best case,
  // never the current toggle. A control-plane deployment (or private collab) registers
  // an extra section, so we can point at "your network" only when one will mount.
  const canShareOtherwise = shareSectionBuilders().length > 0;
  // The .lolly card (when present) gets an accent halo + a "Recommended" cue whenever the
  // verdict routes the user to it - a dropped-content link OR one so long it's impractical
  // to pass around. Toggled off again for a clean/merely-long link so it stays meaningful.
  const fileCard = dialog.querySelector<HTMLDetailsElement>('[data-share-file]');
  const highlightLolly = (on: boolean) => {
    if (!fileCard) return;
    fileCard.classList.toggle('is-recommended', on && !!lolly);
    if (on && !states.has(fileCard.dataset.shareSection!)) fileCard.open = true;
  };
  const renderVerdict = (bestLen: number) => {
    const lost = fidelity && !fidelity.faithful ? fidelity : null;
    // Past the browser hard cap even the packed link is impractical - the same red
    // verdict as dropped content, and the same remedy (the .lolly). `bestLen` is already
    // the shortest achievable length, so this judges the packed form, not the toggle.
    const tooLong = bestLen >= BROWSER_HARD_CAP;
    if (lost || tooLong) {
      warnEl.hidden = false;
      warnEl.classList.add('is-error');
      warnEl.classList.remove('is-warn');
      highlightLolly(true);
      // Prefer the file (it carries everything faithfully); fall back to a network
      // share, then to "trim it" when neither vehicle is available here.
      const remedy = lolly ? 'Download it as a file below to send everything.'
        : canShareOtherwise ? 'To send everything, share it on your network below.'
        : 'To send everything, reduce these elements.';
      warnEl.textContent = lost
        ? `⚠️ A link can't include ${describeLoss(lost)}, so it won't be there when someone opens this. ${remedy}`
        : `⚠️ This link is very large (${bestLen.toLocaleString()} characters) - too long to reliably share. You can keep working, but ${lolly ? 'download the .lolly file below to share it with its files and a contents receipt' : canShareOtherwise ? 'share it on your network below' : 'reduce some elements'}.`;
    } else if (bestLen >= SHARE_WARN_LEN) {
      warnEl.hidden = false;
      warnEl.classList.add('is-warn');
      warnEl.classList.remove('is-error');
      highlightLolly(false);
      warnEl.textContent = `This link is long (${bestLen.toLocaleString()} characters). Turn on 'Shortest link' below${lolly ? ", or share the .lolly file for guaranteed fidelity" : ''}.`;
    } else {
      warnEl.hidden = true;
      warnEl.classList.remove('is-error', 'is-warn');
      highlightLolly(false);
    }
  };
  let readableLen = shareUrlFromParts(baseParts, toolId).length;
  renderVerdict(readableLen);   // best guess until the packed length lands

  const flagParts = () => {
    const parts: string[] = [];
    for (const cb of checkboxes) {
      if (cb.disabled || !cb.checked) continue;
      parts.push(cb.dataset.flag === '_v' ? `_v=${encodeURIComponent(String(version))}` : cb.dataset.flag!);
    }
    return parts;
  };

  const refresh = () => {
    // On-visit flags always ride readable (and outside the pack/encryption, where
    // they still override on load) so the recipient - and any crawler - can see the
    // behaviour even on a password-protected link.
    const flags = flagParts();
    const encryptOn = !!encryptCb?.checked;
    // A password-protected link is inherently packed+encrypted, so it overrides the
    // "shortest" choice; grey that out while it's on.
    shortestCb.disabled = encryptOn;
    shortestRow.classList.toggle('is-disabled', encryptOn);
    if (encryptOn && !encToken) {
      // Never emit an unencrypted link while protection is on but no token is ready.
      field.value = encryptPw?.value ? 'Generating protected link…' : 'Enter a password above to generate the protected link.';
      // toggleAttribute (not .disabled): a jelly-button reflects disabled via the
      // ATTRIBUTE only, and a native <button> honours it too - one path for both.
      copyBtn.toggleAttribute('disabled', true);
      return;
    }
    copyBtn.toggleAttribute('disabled', false);
    const base = (encryptOn && encToken) ? [`${ENC_PARAM}=${encToken}`]
      : (shortestCb?.checked && packedToken) ? [`${PACK_PARAM}=${packedToken}`]
      : [...baseParts];
    const webUrl = shareUrlFromParts([...base, ...flags], toolId);
    const appUrl = toLollyAppLink(webUrl);
    if (appLinkCb) {
      appLinkCb.disabled = !appUrl;
      if (!appUrl) appLinkCb.checked = false;
    }
    field.value = appLinkCb?.checked && appUrl ? appUrl : webUrl;
  };

  // Compute the packed form once. Only offer "Shortest link" when the codec is
  // available AND it actually beats the readable link; auto-check it when the
  // readable link is long enough to risk the URL ceiling.
  let packReq = 0;
  const recomputePack = () => {
    const mine = ++packReq;
    packedToken = null;
    shortestCb.checked = false;
    shortestRow.hidden = true;
    readableLen = shareUrlFromParts(baseParts, toolId).length;
    renderVerdict(readableLen);
    if (!isPackAvailable() || !baseQuery) return;
    packQuery(baseQuery).then(token => {
      if (!token || mine !== packReq || !dialog.isConnected) return;
      const packedLen = shareUrlFromParts([`${PACK_PARAM}=${token}`], toolId).length;
      if (packedLen >= readableLen) return;
      packedToken = token;
      shortestRow.hidden = false;
      if (readableLen >= AUTO_PACK_MIN) shortestCb.checked = true;
      renderVerdict(packedLen);
      refresh();
    }).catch(() => {});
  };
  recomputePack();
  shortestCb?.addEventListener('change', refresh);
  appLinkCb?.addEventListener('change', refresh);

  // Password-protect: recompute the encrypted token as the password changes
  // (debounced - PBKDF2 is deliberately slow). The password never leaves the client;
  // only the ciphertext token goes into the link.
  let encReq = 0;
  let encDebounce: ReturnType<typeof setTimeout> | undefined;
  const recomputeEnc = () => {
    if (encryptBody) encryptBody.hidden = !encryptCb?.checked;
    const pw = encryptPw?.value ?? '';
    const mine = ++encReq;
    if (!encryptCb?.checked || !pw) { encToken = null; refresh(); return; }
    packEncrypted(baseQuery, pw).then(tok => {
      if (mine !== encReq || !dialog.isConnected) return;   // superseded or closed
      encToken = tok;
      refresh();
    }).catch(() => { if (mine === encReq) { encToken = null; refresh(); } });
  };
  encryptCb?.addEventListener('change', () => { encToken = null; recomputeEnc(); });
  encryptPw?.addEventListener('input', () => {
    encReq++;
    encToken = null; refresh();                 // show "Generating…" immediately
    clearTimeout(encDebounce);
    encDebounce = setTimeout(recomputeEnc, 250);
  });

  for (const checkbox of dialog.querySelectorAll<HTMLInputElement>('[data-personal-field]')) {
    checkbox.addEventListener('change', () => {
      const selected = [...dialog.querySelectorAll<HTMLInputElement>('[data-personal-field]:checked')]
        .flatMap(input => personal[Number(input.dataset.personalField)]?.parts ?? []);
      baseParts.splice(0, baseParts.length, ...publicParts, ...selected);
      baseQuery = baseParts.join('&');
      encToken = null;
      clearTimeout(encDebounce);
      recomputePack();
      recomputeEnc();
      refresh();
    });
  }

  // `full` collapses the sidebar, so the export panel has nowhere to anchor - 
  // full wins, exactly as the URL handling and CSS do. Reflect that here.
  const syncFullWins = () => {
    const dim = !!fullCb?.checked;
    if (optionsCb) { optionsCb.disabled = dim; if (dim) optionsCb.checked = false; }
    optionsRow?.classList.toggle('is-disabled', dim);
  };

  for (const cb of checkboxes) cb.addEventListener('change', () => { syncFullWins(); refresh(); });

  dialog.querySelector<HTMLButtonElement>('.share-copy-btn')!.addEventListener('click', async function (this: HTMLButtonElement) {
    const prev = this.textContent;
    try { await copyToClipboard(field.value); }
    catch {
      this.textContent = t('Could not copy');
      announce(t('Could not copy to the clipboard.'), { assertive: true });
      setTimeout(() => { this.textContent = prev; }, 1500);
      return;
    }
    bumpMetric('linksCopied');
    announce('Shareable link copied');
    this.textContent = 'Copied!';
    setTimeout(() => { this.textContent = prev; }, 1500);
  });

  // "QR" beside Copy (plans/143 M3): hand the CURRENT link (options included) to
  // the QR Code tool. Navigation closes this dialog via the modal's nav teardown.
  // For QR use the link is first made alphanumeric-friendly: a packed `z` token
  // is re-minted in its tag-2 base32 form and the case-insensitive scheme+host
  // upper-cased, so both land in the QR encoder's 5.5-bits/char alphanumeric
  // segments and the printed code drops a version or two. The scanned link
  // decodes identically (unpackToken reads both tags); any failure just falls
  // back to the link as-is.
  dialog.querySelector<HTMLButtonElement>('.share-qr-btn')?.addEventListener('click', async () => {
    let link = field.value;
    try {
      const [whole, sep, rawToken] = link.match(new RegExp(`([?&])${PACK_PARAM}=([^&]+)`)) ?? [];
      if (whole && sep && rawToken) {
        const readable = await unpackToken(rawToken);
        const qrToken = readable == null ? null : await packQuery(readable, { qr: true });
        if (qrToken) link = link.replace(whole, `${sep}${PACK_PARAM}=${qrToken}`);
      }
      link = link.replace(/^(?:https?:\/\/[^/#?]*|lolly:\/\/)/i, (origin) => origin.toUpperCase());
    } catch { link = field.value; }
    const { navigateTo } = await import('../nav.ts');
    navigateTo(`#/tool/qr-code?url=${encodeURIComponent(link)}`);
  });

  // "Copy credit" (plans/143 V2): a ready caption for wherever the work is
  // posted - the credit travels BESIDE the artwork, opt-in, one click.
  dialog.querySelector<HTMLButtonElement>('.share-credit-btn')?.addEventListener('click', async function (this: HTMLButtonElement) {
    const prev = this.textContent;
    try { await copyToClipboard(`Made with Lolly · lolly.tools\n${field.value}`); }
    catch {
      this.textContent = t('Could not copy');
      announce(t('Could not copy to the clipboard.'), { assertive: true });
      setTimeout(() => { this.textContent = prev; }, 1500);
      return;
    }
    announce('Credit caption copied');
    this.textContent = 'Copied!';
    setTimeout(() => { this.textContent = prev; }, 1500);
  });

  const licensedEl = dialog.querySelector<HTMLElement>('[data-lolly-licensed]');
  const fileSummaryEl = dialog.querySelector<HTMLElement>('[data-lolly-summary]');

  // The "include the tool" toggle: revealed once the offer resolves (a `custom` tool -
  // a fork / private-brand tool a recipient likely lacks - defaults it checked). Its live
  // state feeds every .lolly build below.
  const toolCheck = dialog.querySelector<HTMLInputElement>('[data-lolly-tool]');
  if (lolly?.toolOffer && toolCheck) {
    lolly.toolOffer().then((offer) => {
      toolCheck.checked = offer.suggested;
      dialog.querySelector('[data-lolly-tool-wrap]')?.removeAttribute('hidden');
    }).catch(() => { /* no offer ⇒ the toggle stays hidden, tool travels by reference */ });
  }
  const includeTool = (): boolean => !!toolCheck?.checked;

  const lollyBtn = dialog.querySelector<HTMLButtonElement>('[data-lolly-download]');
  if (lolly && lollyBtn) {
    wireLollyDelivery(lolly, lollyBtn, licensedEl, fileSummaryEl, (b, f) => lolly.save(b, f), includeTool,
      { idle: 'Download .lolly', done: 'Downloaded', fail: 'Could not build the file', verb: 'Download' });
  }
  const shareBtn = dialog.querySelector<HTMLButtonElement>('[data-lolly-share]');
  if (lolly?.share && shareBtn) {
    const share = lolly.share;
    // OS share sheet, with a download fallback when the sheet declines (no target).
    wireLollyDelivery(lolly, shareBtn, licensedEl, fileSummaryEl,
      async (b, f) => { if (!(await share(b, f))) await lolly.save(b, f); }, includeTool,
      { idle: 'Send to…', done: 'Shared', fail: 'Could not share', verb: 'Send' });
  }

  dialog.querySelector('.share-done')!.addEventListener('click', () => modal.close());
  // Escape and a backdrop click are handled by mountModal (both close with no value).

  syncFullWins();
  refresh();
  if (autofocus) { field.focus(); field.select(); }
  else dialog.querySelector<HTMLElement>('.share-dialog-actions')!.hidden = true;

  mountRegisteredSections(dialog, { toolId, baseParts, currentFormat: currentFmt, copy: copyToClipboard, close: () => modal.close(), ...(readDocument ? { document: readDocument } : {}) }, states);

  return dialog;
}

/**
 * Extra sections from the generic registry (empty by default, so nothing mounts and
 * the dialog is byte-identical without a registrant). A deployment's optional control
 * plane registers one to offer instance-hosted links (see src/org/). Builders may be
 * async; each mounts only if it returns a node and the dialog is still open, at its
 * place by the registry's ordering hint (equal hints keep arrival order). Each gets
 * the dialog's own copy affordance. A node returned directly mounts at once, in the
 * same task as the rest of the surface: the docked panel rebuilds the surface on
 * every edit, and a section laid out a frame late pushes the rest of the panel down.
 *
 * A section registered with placement 'lead' goes above the dialog's own link row,
 * under the heading, in a host made only when the first such section arrives, with a
 * small heading over the dialog's own link so the two links are told apart. Every
 * other section, and a lead section when the dialog has no own link row to lead,
 * goes after the dialog's own rows, where they always went.
 */
function mountRegisteredSections(dialog: HTMLElement, ctx: ShareSectionContext, states: Map<string, boolean>): void {
  const extraHost = dialog.querySelector<HTMLElement>('[data-extra-sections]');
  const builders = shareSectionBuilders();
  if (!extraHost || !builders.length) return;
  const ownRow = dialog.querySelector<HTMLElement>('.share-dialog-body > .share-link-row');
  let leadHost: HTMLElement | null = null;
  const hostFor = (placement: ShareSectionPlacement): HTMLElement => {
    if (placement !== 'lead' || !ownRow) return extraHost;
    if (!leadHost) {
      leadHost = document.createElement('div');
      leadHost.className = 'share-lead-sections';
      leadHost.dataset.leadSections = '';
      const ownHeading = document.createElement('h3');
      ownHeading.className = 'share-own-heading';
      // The body's flex gap spaces the rows; the negative margin keeps the heading with its row.
      ownHeading.style.cssText = 'margin:0 0 -.5rem;font-size:.82rem;font-weight:650;letter-spacing:.02em;text-transform:uppercase;color:hsl(var(--muted-foreground))';
      ownHeading.textContent = 'Link to this version';
      ownRow.before(leadHost, ownHeading);
    }
    return leadHost;
  };
  for (const build of builders) {
    // The place is settled before the builder runs, so a section told it leads does.
    const placement: ShareSectionPlacement = shareSectionPlacement(build) === 'lead' && ownRow ? 'lead' : 'after';
    const mount = (node: HTMLElement | null): void => {
      if (!node) return;
      const section = disclosureForRegisteredSection(node);
      restoreSectionStates(section, states);
      mountShareSection(hostFor(placement), section, shareSectionOrder(build));
    };
    try {
      const built = build(placement === 'lead' ? { ...ctx, placement } : ctx);
      // A late node mounts only while the dialog is still open. One returned directly
      // mounts as part of building the surface, which may not be on the page yet.
      if (built && 'then' in built) built.then((node) => { if (dialog.isConnected) mount(node); }, () => { /* a section that fails to build simply doesn't appear */ });
      else mount(built);
    } catch { /* a section that fails to build simply doesn't appear */ }
  }
}

/** Keep a builder's controls and event listeners inside the shared disclosure. */
function disclosureForRegisteredSection(node: HTMLElement): HTMLElement {
  if (node.matches('details.input-section')) return node;
  const heading = node.querySelector<HTMLElement>(':scope > h3');
  if (!heading?.textContent) return node;
  const { section, body } = createShareSection(heading.textContent, 'share', { className: 'share-registered-section' });
  section.dataset.shareSection = `registry:${node.className || heading.textContent}`;
  heading.remove();
  node.style.marginTop = '';
  node.style.paddingTop = '';
  node.style.borderTop = '';
  body.append(node);
  return section;
}

/**
 * Wire a .lolly delivery button - Download (save to disk) or "Send to…" (OS share
 * sheet, with a save fallback). Build once holding licensed brand content back (the
 * safe default); only if the result reports licensed assets do we ask whether to include
 * them - so an ordinary design goes out in one click, and licensed content never travels
 * without an explicit, informed yes. `deliver` is the delivery strategy; `labels.verb`
 * ("Download"/"Send") keeps the licensed-choice copy honest for each.
 */
interface DeliveryLabels { idle: string; done: string; fail: string; verb: string }

function wireLollyDelivery(
  lolly: ShareDialogLolly,
  btn: HTMLButtonElement,
  licensedEl: HTMLElement | null,
  summaryEl: HTMLElement | null,
  deliver: (blob: Blob, filename: string) => Promise<void>,
  includeTool: () => boolean,
  labels: DeliveryLabels,
): void {
  const busy = (on: boolean, label?: string) => { btn.toggleAttribute('disabled', on); if (label) btn.textContent = label; };
  const done = () => { busy(false, labels.done); setTimeout(() => { btn.textContent = labels.idle; }, 1800); };
  const fail = () => busy(false, labels.fail);
  const run = (blob: Blob, filename: string) => deliver(blob, filename).then(done, fail);
  const showSummary = (built: Awaited<ReturnType<ShareDialogLolly['build']>>): void => {
    if (!summaryEl) return;
    const bytes = built.blob.size;
    const size = bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
    const s = built.summary;
    const bits = [
      `${size} .lolly`,
      `${s.assetCount} embedded ${s.assetCount === 1 ? 'file' : 'files'}`,
      s.byReferenceCount ? `${s.byReferenceCount} external ${s.byReferenceCount === 1 ? 'reference' : 'references'}` : 'no external references',
      s.toolFiles ? `tool included (${s.toolFiles} ${s.toolFiles === 1 ? 'file' : 'files'})` : 'tool by reference',
    ];
    summaryEl.textContent = bits.join(' · ');
    summaryEl.hidden = false;
  };

  btn.addEventListener('click', async () => {
    const section = btn.closest<HTMLDetailsElement>('details.share-section');
    if (section) section.open = true;
    if (licensedEl) { licensedEl.hidden = true; licensedEl.textContent = ''; }
    busy(true, 'Preparing…');
    const withTool = includeTool();
    let built: Awaited<ReturnType<ShareDialogLolly['build']>>;
    try { built = await lolly.build({ includeLicensed: false, includeTool: withTool }); } catch { fail(); return; }
    showSummary(built);
    if (!built.summary.hasLicensed) { void run(built.blob, built.filename); return; }
    offerLicensedChoice(built, lolly, licensedEl, busy, run, fail, showSummary, withTool, labels);
  });
}

/** Present the licensed-content choice: deliver without the brand assets (the file
 *  already built), or rebuild including them. Handing the file over distributes those
 *  bytes, so the decision is explicit - and worded for the chosen verb (download/send). */
function offerLicensedChoice(
  built: { blob: Blob; filename: string; summary: LollySummary },
  lolly: ShareDialogLolly,
  licensedEl: HTMLElement | null,
  busy: (on: boolean, label?: string) => void,
  run: (blob: Blob, filename: string) => Promise<void>,
  fail: () => void,
  showSummary: (built: { blob: Blob; filename: string; summary: LollySummary }) => void,
  includeTool: boolean,
  labels: DeliveryLabels,
): void {
  busy(false, labels.idle);
  const n = Math.max(1, built.summary.licensedExcluded);
  const it = n === 1 ? 'it' : 'them';
  if (!licensedEl) { void run(built.blob, built.filename); return; }   // nowhere to ask ⇒ safe default
  licensedEl.hidden = false;
  const verb = labels.verb;
  // "Held back" rather than "licensed": since plan 253 the hold-back also covers a
  // catalog work whose licence was never recorded, which is not the same as a brand
  // asset under known terms. CREDITS.txt inside the file names each one and why.
  licensedEl.innerHTML = `
    <p class="share-file-warn">⚠️ This design uses ${n} catalog ${n === 1 ? 'work' : 'works'} whose bytes are held back. The file leaves ${it} out and CREDITS.txt says why. Including ${it} shares the actual ${n === 1 ? 'file' : 'files'} with whoever opens the .lolly.</p>
    <div class="share-file-actions">
      <button type="button" class="btn" data-lolly-without>${verb} without ${it}</button>
      <button type="button" class="btn" data-lolly-include>Include and ${verb.toLowerCase()}</button>
    </div>`;
  licensedEl.querySelector<HTMLButtonElement>('[data-lolly-without]')!.addEventListener('click', () => {
    licensedEl.hidden = true;
    void run(built.blob, built.filename);
  });
  licensedEl.querySelector<HTMLButtonElement>('[data-lolly-include]')!.addEventListener('click', async () => {
    licensedEl.hidden = true;
    busy(true, 'Preparing…');
    try {
      const full = await lolly.build({ includeLicensed: true, includeTool });
      showSummary(full);
      await run(full.blob, full.filename);
    } catch { fail(); }
  });
}
