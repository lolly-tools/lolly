// SPDX-License-Identifier: MPL-2.0
/**
 * catalog details: a rondocode song (plan 301).
 *
 * A song asset is code that computes audio. The sheet shows what a person needs to
 * trust it and use it: the song's own source, read-only, with its language; an
 * audition, rendered on this device to a WAV blob (the zzfxm precedent: it plays
 * in any browser and is revoked when the sheet closes); what the render could not
 * play, named in plain sentences rather than passed off as silence; and a credit
 * line naming rondocode and saying where the code ran.
 *
 * The code never runs here. lib/rondo-render.ts runs it in the `vm` execution
 * class (QuickJS in its own Worker), and this module only reads the result.
 *
 * Every function takes the details context first (see details-context.ts).
 */
import { escape as escapeText } from '../../utils.ts';
import { t, tRaw } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { navigateTo } from '../../nav.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { bindOp, type DetailsCtx } from './details-context.ts';

/** Is this asset a rondocode song? */
export const isRondoAsset = (ref: AssetRef): boolean => ref.format === 'rondo';

/** The language, in the words a person uses for it on screen. */
function languageLabel(lang: string): string {
  if (lang === 'rondo') return t('rondo language');
  if (lang === 'js') return t('JavaScript');
  return t('Not stated');
}

/**
 * The song section's markup, filled after mount by `wireRondo`. Empty for any other
 * asset. The status line is live, so a screen reader hears the render finish.
 */
export function rondoSectionHtml(dt: DetailsCtx): string {
  if (!isRondoAsset(dt.ref)) return '';
  const lang = String((dt.ref.meta?.rondo as { lang?: unknown } | undefined)?.lang ?? '');
  return `<section class="cat-details-rondo" data-rondo aria-label="${escapeText(t('Song'))}">
      <h3 class="cat-inspector-heading">${t('Song')}</h3>
      <dl class="cat-details-meta">
        <div><dt>${t('Language')}</dt><dd data-rondo-lang>${escapeText(languageLabel(lang))}</dd></div>
      </dl>
      <p class="cat-rondo-status" data-rondo-status role="status">${t('Rendering the song…')}</p>
      <ul class="cat-rondo-findings" data-rondo-findings hidden></ul>
      <div class="cat-rondo-code-head">
        <span class="cat-tech-head">${t('Source')}</span>
        <button type="button" class="cat-tag" data-rondo-copy disabled>${t('Copy code')}</button>
        <button type="button" class="cat-tag" data-rondo-open disabled>${t('Open in Rondocode')}</button>
      </div>
      <pre class="cat-rondo-code" data-rondo-code tabindex="0" aria-label="${escapeText(t('Song source, read-only'))}"></pre>
      <p class="cat-rondo-credit" data-rondo-credit></p>
    </section>`;
}

/**
 * Read the song, show its source, render the audition and list what the render
 * could not play. `audioEl` is the sheet's player; the WAV blob url it receives is
 * recorded on `dataset.wavBlob`, which the sheet's close handler revokes.
 */
export async function wireRondo(dt: DetailsCtx, audioEl: HTMLAudioElement, note: HTMLElement | null): Promise<void> {
  const { cat, dlg, ref } = dt;
  const box = dlg.querySelector<HTMLElement>('[data-rondo]');
  const status = box?.querySelector<HTMLElement>('[data-rondo-status]') ?? null;
  const list = box?.querySelector<HTMLElement>('[data-rondo-findings]') ?? null;
  const codeEl = box?.querySelector<HTMLElement>('[data-rondo-code]') ?? null;
  const langEl = box?.querySelector<HTMLElement>('[data-rondo-lang]') ?? null;
  const copyBtn = box?.querySelector<HTMLButtonElement>('[data-rondo-copy]') ?? null;
  const current = (): boolean => cat.detailsDialog === dlg;
  const fail = (sentence: string): void => {
    if (!current()) return;
    if (status) { status.textContent = sentence; status.classList.add('is-failed'); }
    if (note) { note.textContent = sentence; note.hidden = false; }
  };

  // Both at the point of use, so the assets chunk carries neither the renderer
  // client nor its sentences until a song is opened.
  const [r, words] = await Promise.all([import('../../lib/rondo-render.ts'), import('../../lib/rondo-words.ts')]);
  const credit = box?.querySelector<HTMLElement>('[data-rondo-credit]');
  if (credit) credit.textContent = words.rondoCreditLine();
  let bytes: Uint8Array;
  try {
    const res = await fetch(ref.url);
    if (!res.ok) throw new Error(String(res.status));
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch {
    fail(t('The song file could not be read.'));
    return;
  }
  const src = r.sourceFromBytes(bytes);
  if (!src) { fail(t('That file is not a rondocode song Lolly can read.')); return; }
  if (!current()) return;
  if (codeEl) codeEl.textContent = src.code;
  if (langEl) langEl.textContent = languageLabel(src.lang);
  // The utility takes the song through URL mode, like any tool, so the link it
  // opens is also the one a person could share.
  const openBtn = box?.querySelector<HTMLButtonElement>('[data-rondo-open]') ?? null;
  if (openBtn) {
    openBtn.disabled = false;
    openBtn.addEventListener('click', () => {
      const q = new URLSearchParams({ code: src.code, language: src.lang, name: src.name });
      navigateTo(`#/tool/rondocode?${q.toString()}`);
    });
  }
  if (copyBtn) {
    copyBtn.disabled = false;
    copyBtn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(src.code); announce(t('Code copied.')); }
      catch { announce(t('The code could not be copied. It is still selectable.')); }
    });
  }

  try {
    const { url, render } = await r.renderRondoToWavUrl({ code: src.code, lang: src.lang, name: src.name });
    if (!current()) { URL.revokeObjectURL(url); return; }
    audioEl.dataset.wavBlob = url;
    audioEl.src = url;
    // A song that did not state its language was read by upstream's sniff; say which.
    if (langEl && src.lang === 'auto') langEl.textContent = tRaw('{language}, detected', { language: languageLabel(render.lang) });
    if (status) {
      status.textContent = render.findings.length
        ? t('Not every part plays:')
        : t('Every part plays in this render.');
    }
    if (list && render.findings.length) {
      list.replaceChildren(...render.findings.map((f) => {
        const li = document.createElement('li');
        li.textContent = words.rondoFindingSentence(f);
        return li;
      }));
      list.hidden = false;
    }
  } catch (err) {
    fail(words.rondoFailureSentence(err));
  }
}

export function rondoOps(dt: DetailsCtx) {
  return {
    rondoSectionHtml: bindOp(dt, rondoSectionHtml),
    wireRondo: bindOp(dt, wireRondo),
  };
}
