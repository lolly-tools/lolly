// SPDX-License-Identifier: MPL-2.0
/**
 * The rate-cards manager - where a printer's own rate card, dropped on this
 * device, becomes a stored asset Lolly can later multiply COUNTED quantities by.
 *
 * Modelled on `profiles-manager.ts`: a `mountModal`, the `.updz` dropzone reused
 * verbatim, a list of rows with per-row Remove, escape-to-close inherited from the
 * native <dialog>, and refusals stated in one status line (never a nested modal).
 * It has NO preset/fetch section - a rate card has no registry to pull from,
 * nothing is ever fetched - and NO intent controls.
 *
 * ## No money here
 *
 * This phase STORES and VALIDATES only. The modal shows the filename, the issuer's
 * own claim as reported speech, the currency, and "prices N of M lines". It NEVER
 * renders a currency figure - that is Phase 4's export panel. A number Lolly made
 * up and presented as money is worse than showing nothing.
 *
 * ## Two layers kept apart (rule 5)
 *
 * Every row separates the FACTS Lolly knows (filename, digest, size, date added)
 * from the CLAIMS the file makes (issuer name / issue date). The claim is rendered
 * as reported speech - *"The file says: … Lolly has not verified this."* - never as
 * a bare attribution merged into the facts.
 *
 * ## The create flow starts every rate EMPTY
 *
 * "New card" downloads a scaffold whose every `rate` is an empty string. An empty
 * rate is schema-invalid, so an unedited scaffold is refused on ingest (and each
 * line would report "counted only" once priced). Copying the structure is free;
 * inventing the numbers is the one thing the whole design refuses.
 */

import '../styles/parts/dropzone.css';   // the .updz dropzone this reuses verbatim
import '../styles/parts/rate-cards-panel.css';
import {
  ingestRateCard, listRateCards, removeRateCard, isRateCardIngestFailure,
} from '../lib/rate-cards.ts';
import type { RateCardsHost, RateCardEntry, RateCardIngestFailure } from '../lib/rate-cards.ts';
import { mountModal } from './modal.ts';
import { icon } from '../lib/icons.ts';
import { announce } from '../a11y.ts';
import { escape } from '../utils.ts';
import { t, tRaw } from '../i18n.ts';

export interface RateCardsPanelOpts {
  host: RateCardsHost;
  /** A card landed or left the library - the caller may want to refresh a picker. */
  onChange?(): void | Promise<void>;
}

// ── Pure, DOM-free helpers (exported for unit tests) ──────────────────────────

/**
 * The scaffold "New card" downloads. Every line kind present, every `rate` an
 * EMPTY STRING - schema-invalid on purpose, so an unedited copy is refused on
 * ingest. There is no numeric rate anywhere: Lolly ships structure, never a price.
 */
export const EMPTY_RATECARD_TEMPLATE = JSON.stringify({
  $format: 'lolly-ratecard',
  formatVersion: 1,
  issuer: { name: '', url: '', issued: '', validUntil: '', note: "Type your printer's own numbers. Every rate starts empty on purpose - Lolly never invents a price." },
  currency: '',
  taxIncluded: false,
  minimumCharge: '',
  breakMode: 'flat',
  sheet: { width: '', height: '', unit: 'mm' },
  lines: [
    { id: 'plate-setup', kind: 'perPlate', rate: '' },
    { id: 'run', kind: 'perSheet', rate: '', breaks: [{ min: 1, rate: '' }] },
    { id: 'spot-uv', kind: 'perArea', rate: '', unit: 'm2-sheet', finish: 'spot-uv' },
    { id: 'variant', kind: 'perQuantity', quantityKind: 'variantRows', rate: '' },
    { id: 'per-piece', kind: 'perUnit', rate: '' },
    { id: 'artwork', kind: 'perJob', rate: '' },
  ],
}, null, 2);

/** Refusal copy, one line each - the same two refusals as ingest plus the example guard. */
export function refusalMessage(error: RateCardIngestFailure['error']): string {
  switch (error) {
    case 'not-a-rate-card':
      return t("That file isn’t a rate card Lolly can read.");
    case 'no-priced-lines':
      return t("This card has no priced lines, so Lolly can’t cost anything with it.");
    case 'example-card':
      return t("This is the example card. Type your printer’s own rates into a copy.");
  }
}

/** How many kB, for a fact line. */
function kb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} kB`;
}

/** The date a card was added, in the reader's own locale (added-at is a FACT). */
function addedOn(ms: number): string {
  if (!ms) return '';
  try { return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return ''; }
}

/**
 * The FACT line - only things Lolly itself knows: the currency the card declares,
 * its digest, its size, and when it was added. No claim from the file appears here.
 */
export function factLine(e: RateCardEntry): string {
  return [
    e.currency,
    e.digest,
    kb(e.bytes),
    addedOn(e.addedAt),
  ].filter(Boolean).join(' · ');
}

/**
 * The reported-speech line, or null when the file claims nothing. Deliberately a
 * QUOTE with an explicit "Lolly has not verified this" - an issuer name typed inside
 * a JSON file is unverified, and rendering it as a bare attribution would launder a
 * claim into a fact.
 */
export function reportedSpeech(e: RateCardEntry): string | null {
  const said = [e.issuerName, e.issued].filter(Boolean).join(', ');
  if (!said) return null;
  return tRaw('The file says: {said}. Lolly has not verified this.', { said });
}

/** "prices N of M lines" - a COUNT, never money. */
export function pricedSummary(e: RateCardEntry): string {
  return t('Prices {n} of {m} lines', { n: String(e.pricedLineCount), m: String(e.lineCount) });
}

// ── The row ───────────────────────────────────────────────────────────────────

function rowHtml(e: RateCardEntry): string {
  const claim = reportedSpeech(e);
  return `
    <li class="rcm-row" data-rcm-digest="${escape(e.digest)}">
      <div class="rcm-row-main">
        <span class="rcm-row-name">${escape(e.name)}</span>
        <span class="rcm-row-fact">${escape(factLine(e))}</span>
        ${claim ? `<span class="rcm-row-claim">${escape(claim)}</span>` : ''}
        <span class="rcm-row-priced">${escape(pricedSummary(e))}</span>
      </div>
      <button type="button" class="rcm-remove" data-rcm-remove
        aria-label="${escape(tRaw('Remove {name}', { name: e.name }))}">${escape(t('Remove'))}</button>
    </li>`;
}

// ── The modal ─────────────────────────────────────────────────────────────────

/** Open the manager. Resolves when it closes. */
export function openRateCardsPanel(opts: RateCardsPanelOpts): Promise<void> {
  return new Promise<void>((resolve) => {
    const modal = mountModal<void>(`
      <div class="rcm">
        <header class="rcm-head">
          <h2 class="rcm-title">${escape(t('Rate cards'))}</h2>
          <button type="button" class="rcm-close" data-rcm-close
            aria-label="${escape(t('Close'))}">×</button>
        </header>
        <p class="rcm-intro">${escape(t('Drop the rate card your printer gave you. Lolly multiplies its numbers by quantities it counted - it never invents a price. Nothing leaves this device.'))}</p>
        <label class="updz rcm-drop">
          <input type="file" class="updz-input visually-hidden" data-rcm-file multiple
            accept=".json,application/json"
            aria-label="${escape(t('Add a rate card'))}">
          <span class="updz-icon" aria-hidden="true">${icon('upload')}</span>
          <span class="updz-copy">
            <span class="updz-text">${escape(t('Drop a rate card here, or'))} <span class="updz-browse">${escape(t('browse'))}</span></span>
            <span class="updz-hint">${escape(t('A .json rate card - every rate is a number you typed from your supplier.'))}</span>
          </span>
        </label>
        <div class="rcm-actions">
          <button type="button" class="rcm-new" data-rcm-new>
            <span aria-hidden="true">${icon('plus')}</span>${escape(t('New card'))}
          </button>
        </div>
        <p class="rcm-msg" data-rcm-msg role="status" aria-live="polite" hidden></p>
        <ul class="rcm-list" data-rcm-list></ul>
        <p class="rcm-empty" data-rcm-empty hidden>${escape(t('No rate cards on this device yet.'))}</p>
      </div>`, {
      className: 'modal rcm-modal',
      ariaLabel: t('Rate cards'),
      initialFocus: (el) => el.querySelector<HTMLElement>('[data-rcm-file]'),
      onClose: () => resolve(),
    });

    const el = modal.el;
    const list = el.querySelector<HTMLElement>('[data-rcm-list]')!;
    const empty = el.querySelector<HTMLElement>('[data-rcm-empty]')!;
    const msg = el.querySelector<HTMLElement>('[data-rcm-msg]')!;
    const file = el.querySelector<HTMLInputElement>('[data-rcm-file]')!;
    const drop = el.querySelector<HTMLElement>('.rcm-drop')!;

    const say = (text: string, tone: 'info' | 'error' = 'info'): void => {
      msg.textContent = text;
      msg.hidden = !text;
      if (text) { msg.dataset.tone = tone; announce(text); }
      else delete msg.dataset.tone;
    };

    async function refresh(): Promise<void> {
      const rows = await listRateCards(opts.host).catch(() => []);
      list.innerHTML = rows.map(rowHtml).join('');
      empty.hidden = rows.length > 0;
    }

    async function take(files: FileList | null): Promise<void> {
      if (!files?.length) return;
      drop.classList.add('is-busy');
      for (const f of Array.from(files)) {
        const r = await ingestRateCard(opts.host, f).catch(
          () => ({ error: 'not-a-rate-card' as const }),
        );
        if (isRateCardIngestFailure(r)) {
          say(refusalMessage(r.error), 'error');
          continue;
        }
        // A stored card - state the COUNTS, never money.
        say(tRaw('Added {name} - {summary}.', { name: r.name, summary: pricedSummary(r).toLowerCase() }));
        await opts.onChange?.();
      }
      drop.classList.remove('is-busy');
      file.value = '';
      await refresh();
    }

    /** Download the empty scaffold for the user to fill in and drop back. Delivery
     *  goes through saveBlob → host.export.download, the verb the Tauri shells
     *  override with a native save, so the scaffold reaches a phone's Files app
     *  instead of being dropped by the WebView (plan 216 item 1). */
    async function newCard(): Promise<void> {
      const blob = new Blob([EMPTY_RATECARD_TEMPLATE], { type: 'application/json' });
      // Lazy import: pro/zip.ts pulls the engine zip barrel, which must not ride a
      // static edge into this modal component (bundle-budget/boot-path guard).
      await (await import('../pro/zip.ts')).saveBlob(blob, 'ratecard-template.json');
      say(t('Downloaded a blank rate card. Type your printer’s own numbers into it, then drop it back here.'));
    }

    file.addEventListener('change', () => { void take(file.files); });
    for (const evt of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      drop.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); });
    }
    for (const evt of ['dragenter', 'dragover']) {
      drop.addEventListener(evt, () => drop.classList.add('is-dragover'));
    }
    for (const evt of ['dragleave', 'drop']) {
      drop.addEventListener(evt, () => drop.classList.remove('is-dragover'));
    }
    drop.addEventListener('drop', (e) => { void take((e as DragEvent).dataTransfer?.files ?? null); });

    el.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-rcm-close]')) { modal.close(); return; }
      if (target.closest('[data-rcm-new]')) { void newCard(); return; }
      const row = target.closest<HTMLElement>('[data-rcm-digest]');
      const digest = row?.dataset.rcmDigest;
      if (digest && target.closest('[data-rcm-remove]')) {
        void Promise.resolve(removeRateCard(opts.host, digest))
          .then(() => opts.onChange?.())
          .then(() => refresh());
      }
    });

    void refresh();
  });
}
