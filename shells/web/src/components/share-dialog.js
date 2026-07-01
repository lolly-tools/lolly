// SPDX-License-Identifier: MPL-2.0
/**
 * The Share-link dialog — a ready-to-copy link plus toggles for the on-visit behaviour
 * flags (fullscreen / export panel / auto-download / copy-on-visit / pin-version) and an
 * optional "Shortest link" pack. Extracted from views/tool.js so it can be invoked from
 * anywhere that has a tool id + serialised state — the tool view's Share button AND the
 * Projects view's per-session "Share link" action (which reconstructs the state from a
 * saved session via createRuntime → serializeUrlState).
 *
 * Callers pass the ALREADY-BUILT query parts (tool inputs + optional export settings) and
 * the tool's manifest; this module only assembles the URL, renders the dialog, and copies.
 */
import { escape } from '../utils.js';
import { bumpMetric } from '../metrics.js';
import { announce } from '../a11y.js';
import { packQuery, isPackAvailable, PACK_PARAM } from '@lolly/engine';

// Above this readable-query length the Share dialog auto-adopts the packed form.
const AUTO_PACK_MIN = 1800;

// Bitmap formats copy to the clipboard as a PNG; text/html copy as text/rich text.
// Vector (svg/pdf) and video formats have no useful clipboard form, so the
// "copy on visit" toggle is hidden for them. Mirrors performCopy()'s branches.
const SHARE_BITMAP_FORMATS = new Set(['png', 'jpg', 'jpeg', 'webp', 'avif']);
const SHARE_TEXT_FORMATS   = new Set(['txt', 'md', 'markdown', 'html']);

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    Object.assign(ta.style, { position: 'fixed', opacity: '0', pointerEvents: 'none' });
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

// Assemble a full shareable URL from query parts. For a tool we emit the crawler-visible
// PATH form (/t/<id>) — the fragment is never sent to the server, so social crawlers only
// ever saw the generic og.png; /t/<id> is the per-tool OG stub that redirects a human back
// into the SPA with these params. `toolId` is passed explicitly (the tool view resolves it
// from location; the Projects session-share passes the saved session's toolId); if absent,
// fall back to the current location.
function shareUrlFromParts(parts, toolId) {
  const qs = parts.join('&');
  const query = qs ? '?' + qs : '';
  const id = toolId
    ?? window.location.pathname.match(/^\/t\/([^/?]+)/)?.[1]
    ?? window.location.hash.match(/^#\/tool\/([^/?]+)/)?.[1];
  if (id) return `${window.location.origin}/t/${id}${query}`;
  return window.location.origin + window.location.pathname + window.location.hash.split('?')[0] + query;
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
export function openShareDialog({ toolId, baseParts = [], manifest = {}, currentFormat = '', title = 'Share this tool' }) {
  // The readable query we'd pack (tool state + export settings) — WITHOUT the on-visit
  // flags, which stay readable outside the pack and merge on load.
  const baseQuery = baseParts.join('&');

  // Only offer toggles the tool can actually honour.
  const canExport  = manifest.render?.export !== false && (manifest.render?.formats?.length ?? 0) > 0;
  const actions    = manifest.render?.actions ?? ['copy', 'download', 'save'];
  const currentFmt = currentFormat || manifest.render?.formats?.[0] || '';
  const isBitmap   = SHARE_BITMAP_FORMATS.has(currentFmt);
  const showCopy   = canExport && actions.includes('copy') && (isBitmap || SHARE_TEXT_FORMATS.has(currentFmt));
  const copyLabel  = isBitmap ? 'Copy image to clipboard on visit' : 'Copy to clipboard on visit';
  const version    = manifest.version;

  const dialog = document.createElement('dialog');
  dialog.className = 'share-dialog';
  dialog.innerHTML = `
    <div class="share-dialog-body">
      <h2>${escape(title)}</h2>
      <div class="share-link-row">
        <input type="text" class="share-link-field" readonly aria-label="Shareable link">
        <button type="button" class="share-copy-btn">Copy</button>
      </div>
      <label class="share-shortest" data-shortest-row hidden>
        <input type="checkbox" data-shortest>
        <span class="share-shortest-text">
          <strong>Shortest link</strong>
          <span class="share-shortest-note" data-shortest-note></span>
        </span>
      </label>
      <fieldset class="share-toggles">
        <legend>When the recipient opens the link…</legend>
        <label><input type="checkbox" data-flag="full"> Open in fullscreen (hide controls)</label>
        <label data-options-row><input type="checkbox" data-flag="options"> Open with the export panel expanded</label>
        ${canExport ? `<label><input type="checkbox" data-flag="export"> Download automatically when opened</label>` : ''}
        ${showCopy ? `<label><input type="checkbox" data-flag="copy"> ${escape(copyLabel)}</label>` : ''}
        ${version ? `<label><input type="checkbox" data-flag="_v"> Pin this tool version (${escape(String(version))})</label>` : ''}
      </fieldset>
      <div class="share-dialog-actions">
        <button type="button" class="share-done">Done</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.showModal();

  const field       = dialog.querySelector('.share-link-field');
  const fullCb      = dialog.querySelector('[data-flag="full"]');
  const optionsCb   = dialog.querySelector('[data-flag="options"]');
  const optionsRow  = dialog.querySelector('[data-options-row]');
  const checkboxes  = [...dialog.querySelectorAll('.share-toggles input[type="checkbox"]')];
  const shortestRow = dialog.querySelector('[data-shortest-row]');
  const shortestCb  = dialog.querySelector('[data-shortest]');
  const shortestNote = dialog.querySelector('[data-shortest-note]');
  // Packed token for the current state — filled in async once we know it helps.
  let packedToken = null;

  const flagParts = () => {
    const parts = [];
    for (const cb of checkboxes) {
      if (cb.disabled || !cb.checked) continue;
      parts.push(cb.dataset.flag === '_v' ? `_v=${encodeURIComponent(String(version))}` : cb.dataset.flag);
    }
    return parts;
  };

  const refresh = () => {
    // On-visit flags always ride readable (and outside the pack, where they still
    // override on load) so the recipient — and any crawler — can see the behaviour.
    const flags = flagParts();
    const base = (shortestCb?.checked && packedToken)
      ? [`${PACK_PARAM}=${packedToken}`]
      : [...baseParts];
    field.value = shareUrlFromParts([...base, ...flags], toolId);
  };

  // Compute the packed form once. Only offer "Shortest link" when the codec is
  // available AND it actually beats the readable link; auto-check it when the
  // readable link is long enough to risk the URL ceiling.
  if (isPackAvailable() && baseQuery) {
    packQuery(baseQuery).then(token => {
      if (!token || !dialog.isConnected) return;
      const readableLen = shareUrlFromParts(baseParts, toolId).length;
      const packedLen   = shareUrlFromParts([`${PACK_PARAM}=${token}`], toolId).length;
      if (packedLen >= readableLen) return;             // packing wouldn't help — don't offer it
      packedToken = token;
      if (shortestNote) shortestNote.textContent = `${readableLen} → ${packedLen} characters`;
      shortestRow.hidden = false;
      if (readableLen >= AUTO_PACK_MIN) shortestCb.checked = true;   // auto-adopt for big states
      refresh();
    }).catch(() => { /* leave the readable link */ });
  }
  shortestCb?.addEventListener('change', refresh);

  // `full` collapses the sidebar, so the export panel has nowhere to anchor —
  // full wins, exactly as the URL handling and CSS do. Reflect that here.
  const syncFullWins = () => {
    const dim = !!fullCb?.checked;
    if (optionsCb) { optionsCb.disabled = dim; if (dim) optionsCb.checked = false; }
    optionsRow?.classList.toggle('is-disabled', dim);
  };

  for (const cb of checkboxes) cb.addEventListener('change', () => { syncFullWins(); refresh(); });

  dialog.querySelector('.share-copy-btn').addEventListener('click', async function () {
    await copyToClipboard(field.value);
    bumpMetric('linksCopied');
    announce('Shareable link copied');
    const prev = this.textContent;
    this.textContent = 'Copied!';
    setTimeout(() => { this.textContent = prev; }, 1500);
  });

  const cleanup = () => { dialog.close(); dialog.remove(); };
  dialog.querySelector('.share-done').addEventListener('click', cleanup);
  dialog.addEventListener('cancel', () => dialog.remove());            // Esc
  dialog.addEventListener('click', e => { if (e.target === dialog) cleanup(); }); // click backdrop

  syncFullWins();
  refresh();
  field.focus();
  field.select();
  return dialog;
}
