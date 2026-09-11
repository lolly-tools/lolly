// SPDX-License-Identifier: MPL-2.0
/**
 * The export panel's "Durable credential" card (plans/202 WP4.2) - the opt-in
 * neural TrustMark mark, its help tip, and the route probe that decides whether
 * the card is offered at all.
 *
 * Tier 2.67 - a neural TrustMark-format mark carrying Lolly's id, so the "made
 * with Lolly" link survives a metadata strip and TrustMark-aware tools can
 * recover it. OFF by default - unlike the pure-JS Imprint, this is a per-export
 * neural encode PLUS a one-time model download (expensive performance-wise), so
 * it is a deliberate opt-in. Raster only. The toggle round-trips into the URL as
 * ?durable=1 (see views/tool.ts syncUrl).
 *
 * The card is BUILT for every durable-capable format but SHOWN only where a route
 * to the model exists (bridge/format-support.ts's durableSupport): cached bytes,
 * the same origin, or the models base a Tauri build points at. On the web that is
 * true at once. Under Tauri it starts hidden and wireDurableConsent's async probe
 * reveals it once the model host answers - and leaves it hidden on a 404, so the
 * toggle is never a no-op.
 */

import { probeDurableSupport } from '../bridge/format-support.js';
import { helpTip } from '../components/help-tip.ts';
import { fmtBytes } from '../lib/format.ts';
import { t } from '../i18n.ts';
import { icon } from '../lib/icons.ts';

// Durable (neural TrustMark) embed is RASTER-ONLY - no pdf/pptx container path yet
// (export.ts durableEmbedCanvas; see plans/28-durable-content-credentials.md).
export const isDurableFmt = (f: string | undefined): boolean =>
  !!f && ['png', 'jpg', 'jpeg', 'webp', 'avif', 'tiff'].includes(f);

/** The card's markup. `present` false (no durable-capable format) renders nothing. */
export function durableCardHtml(opts: { present: boolean; visible: boolean; checked: boolean }): string {
  if (!opts.present) return '';
  const tip = helpTip(
    t(
      'Embeds a durable, invisible credential in the pixels with an on-device AI model, so a copy survives metadata stripping and re-encoding - and TrustMark-aware tools can read it too. Heavier than the Imprint (a neural pass plus a one-time model download), so it is off by default.'
    ),
    { href: '#/verify', text: t('Check a file →') }
  );
  return `
      <div class="section-card export-c2pa export-durable" data-durable-only style="display:${opts.visible ? 'flex' : 'none'}">
        <label class="c2pa-enable field-toggle help-tip-host">
          <input type="checkbox" class="field-check" data-action="durable" ${opts.checked ? 'checked' : ''}>
          <span class="c2pa-head">${icon('imprint', { className: 'c2pa-icon' })}<span>${t('Durable credential')}</span></span>
          ${tip.button}
          ${tip.pop}
        </label>
        <p class="c2pa-hint" data-durable-consent hidden></p>
      </div>`;
}

/**
 * Ask where the durable model can come from, then finish the card: report the
 * route so a panel that started hidden can reveal itself, and say what the first
 * durable export will cost. Two already-translated sentences, the matte dialog's
 * own consent wording - the download itself still happens on that first export,
 * on demand.
 */
export function wireDurableConsent(
  el: HTMLElement,
  present: boolean,
  onRoute: (available: boolean) => void,
): void {
  if (!present) return;
  void probeDurableSupport().then((route) => {
    onRoute(route.available);
    const line = el.querySelector<HTMLElement>('[data-durable-consent]');
    if (!line || !route.available) return;
    line.textContent = route.cached
      ? t('This model is already downloaded - it runs on-device and your image is never uploaded.')
      : t('The first run downloads a {size} model once. It runs on-device and your image is never uploaded.', {
          size: fmtBytes(route.bytes),
        });
    line.hidden = false;
  });
}
