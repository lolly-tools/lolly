// SPDX-License-Identifier: MPL-2.0
/**
 * The asset picker's "Add from URL" entry: the URL-entry card behind the footer
 * button, and the routing that every typed or pasted address goes through (the
 * search box shares it). It came out of views/picker.ts so the dialog file keeps
 * to its wiring. The picker lends the pieces of its takeover chrome it already
 * owns (the toolcard host, show/dismiss, the tool card, the capture fallback), so
 * this module never imports a view.
 *
 * Routing order: a Lolly tool link opens the render card; a direct image (or a
 * remote image proxied through /api/fetch-image on the web, see add-via-url.ts)
 * becomes the asset; anything else gets the picker's screenshot-capture fallback.
 * A sequence number drops a stale async detection when a newer entry replaces it.
 */

import { t } from '../i18n.ts';
import { escapeHtml } from './html.ts';
import { icon } from './icons.ts';
import { fetchImageUrlAsFile } from './add-via-url.ts';
import { isRondoShareUrl } from './media-source.ts';

/** What the picker lends the entry: its takeover chrome and the three outcomes. */
export interface UrlEntryPicker<Desc> {
  /** The element the takeover markup is written into (the picker's toolcard host). */
  takeoverEl: HTMLElement;
  /** Replace the dialog body with this markup. */
  showTakeover: (html: string) => void;
  /** Leave the takeover and return to the active pane. */
  dismissTakeover: () => void;
  /** Describe a Lolly tool link (null when it is not one), or null when this slot
   *  takes no tool renders at all. */
  describeUrl: ((url: string) => Promise<Desc | null>) | null;
  /** Open the render card for a detected tool link. */
  showToolCard: (desc: Desc, url: string) => void;
  /** Store a fetched image as the asset and pick it (or add it to the collection). */
  useImage: (file: File) => Promise<void>;
  /** Store a rondocode share link as a song asset and pick it, or null when this
   *  slot takes no audio. Rejects with a message a person can read. */
  useSong?: ((url: string) => Promise<void>) | null;
  /** Neither a tool link nor an image: offer the capture fallback. */
  showFallback: (url: string) => void;
}

/** The entry the picker drives from its footer button and its search box. */
export interface UrlEntry {
  /** Route one typed or pasted address. */
  handle(raw: string): Promise<void>;
  /** Reveal the URL-entry card. */
  showCard(): void;
  /** Drop any detection still in flight (the search box no longer holds a URL). */
  invalidate(): void;
}

export function createUrlEntry<Desc>(picker: UrlEntryPicker<Desc>): UrlEntry {
  let detectSeq = 0;

  // A pasted URL that points STRAIGHT AT AN IMAGE FILE (…/logo.png, …/photo.svg,
  // a data: URI) becomes the asset itself - fetched, ingested through
  // storeUserUpload (same validation/provenance as an upload), and picked
  // (Andy, 2026-08-28: asset inputs accept URLs, not only files). The reach is
  // lib/add-via-url.ts's: a data:/same-origin URL and the Tauri shells fetch
  // directly; the deployed web PWA, whose CSP refuses arbitrary origins, routes
  // it through the app's own same-origin image proxy (/api/fetch-image). Any
  // failure (not an image, a blocked host, a refusal) returns false so the
  // page-capture / can't-open fallback keeps its turn.
  async function tryDirectUrlAsset(url: string): Promise<boolean> {
    try {
      const file = await fetchImageUrlAsFile(url);
      await picker.useImage(file);
      return true;
    } catch { return false; }
  }

  // Route a URL the user pasted or typed: a Lolly tool link opens the render
  // card; a direct image (or a remote image proxied through /api/fetch-image on
  // the web) becomes the asset; anything else offers the screenshot-capture
  // fallback. Shared by the search box and the footer "Add from URL" button;
  // detectSeq drops a stale async detection when a newer entry supersedes it.
  async function handleUrlEntry(raw: string): Promise<void> {
    const url = raw.trim();
    if (!url) return;
    const seq = ++detectSeq;
    // A rondocode share link carries a song inside it (plan 301): decoded on this
    // device and stored as an audio asset, never fetched and never run here.
    if (picker.useSong && isRondoShareUrl(url)) {
      picker.showTakeover(`<div class="asset-picker-loading">${t('Reading the song…')}</div>`);
      try {
        await picker.useSong(url);
      } catch (err) {
        if (seq !== detectSeq) return;
        const msg = err instanceof Error && err.message ? err.message : t('That song could not be added.');
        picker.showTakeover(`<p class="asset-picker-error">${escapeHtml(msg)}</p>`);
      }
      return;
    }
    picker.showTakeover(`<div class="asset-picker-loading">${t('Checking link…')}</div>`);
    const desc = picker.describeUrl ? await picker.describeUrl(url) : null;
    if (seq !== detectSeq) return;                    // superseded by a newer entry
    if (desc) { picker.showToolCard(desc, url); return; }
    if (await tryDirectUrlAsset(url)) return;          // a direct / proxied image → stored + picked
    if (seq !== detectSeq) return;                    // the fetch attempt took a while - re-check
    picker.showFallback(url);
  }

  // The footer "Add from URL" affordance: reveal-on-click, so it costs no space
  // until asked for. Reuses the toolcard takeover chrome (no new layout), the
  // back arrow / Escape close it, Enter or Add submits through handleUrlEntry.
  function showUrlEntryCard(): void {
    picker.showTakeover(`
      <div class="asset-picker-toolcard">
        <div class="asset-picker-toolcard-head">
          <button type="button" class="asset-picker-toolcard-back" aria-label="${escapeHtml(t('Back to list'))}">←</button>
          ${icon('link', { size: 16 })}
          <span>${t('Add an image from a web address')}</span>
        </div>
        <input type="url" class="asset-picker-urlinput field-input" inputmode="url" autocomplete="off" spellcheck="false"
          placeholder="${escapeHtml(t('Paste an image URL or a Lolly link…'))}" aria-label="${escapeHtml(t('Image or Lolly link'))}" />
        <div class="asset-picker-toolcard-actions">
          <button type="button" class="tc-use url-go">${t('Add')}</button>
        </div>
      </div>`);
    const card = picker.takeoverEl;
    const input = card.querySelector<HTMLInputElement>('.asset-picker-urlinput');
    card.querySelector('.asset-picker-toolcard-back')?.addEventListener('click', picker.dismissTakeover);
    const submit = (): void => { const v = input?.value.trim(); if (v) void handleUrlEntry(v); };
    card.querySelector('.url-go')?.addEventListener('click', submit);
    input?.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') { e.preventDefault(); submit(); } });
    input?.focus();
  }

  return {
    handle: handleUrlEntry,
    showCard: showUrlEntryCard,
    invalidate: () => { detectSeq++; },
  };
}
