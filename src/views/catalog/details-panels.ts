// SPDX-License-Identifier: MPL-2.0
/**
 * catalog details: the edit card, the text, origins and passport panels, the work preview.
 *
 * Every function takes the shared `dt: DetailsCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `dt.<module>.<fn>`. Extracted verbatim
 * from openDetails() by scripts/split-closure.ts.
 */
import { escape as escapeText } from '../../utils.ts';
import { t, tRaw } from '../../i18n.ts';
import { assetAiKind } from '../../lib/genai-pill.ts';
import { analyzeVerifyText, heatBucket } from '../valid-text.ts';
import DOMPurify from 'dompurify';
import { mdToHtml } from '../../lib/markdown.ts';
import { LEXICON_VERSION, analyzeTextSignals, rewordableSpans, suggestRewrites } from '@lolly/engine';
import type { RewordSuggestion } from '@lolly/engine';
import { appendVisibleText } from '../../lib/invisible-chars.ts';
import { lampStripHtml } from '../trust-lamps.ts';
import type { TrustLamp } from '../trust-lamps.ts';
import type { AiSignalsNote } from './shared.ts';
import { bindOp, type DetailsCtx } from './details-context.ts';

export const closeEditCard = (dt: DetailsCtx): void => { dt.dCard?.remove(); dt.dCard = null; };
export const openEditCard = (dt: DetailsCtx, anchor: HTMLElement, html: string): HTMLElement => {
  const { dlg } = dt;
  closeEditCard(dt);
  const holder = dlg.querySelector<HTMLElement>('.cat-details-preview') ?? dlg;
  const card = document.createElement('div');
  card.className = 'cat-edit-card';
  card.innerHTML = html;
  holder.appendChild(card);
  const hr = holder.getBoundingClientRect();
  const ar = anchor.getBoundingClientRect();
  card.style.left = `${Math.round(Math.max(8, Math.min(ar.left - hr.left, hr.width - 356)))}px`;
  card.style.top = `${Math.round(Math.max(8, Math.min(ar.bottom - hr.top + 6, hr.height - 48)))}px`;
  dt.dCard = card;
  return card;
};
/** One wording swap: before → after, apply or keep. */
export const sugCardHtml = (dt: DetailsCtx, s: RewordSuggestion, i: number): string => {
  const work = dt.dCleanedText ?? '';
  const shown = s.kind === 'delete' && s.replacement.length === 1
    ? work.slice(s.index, s.index + s.length - 1)
    : work.slice(s.index, s.index + s.length);
  const after = s.kind === 'delete'
    ? `<em>${t('remove')}</em>`
    : `<span class="cat-reword-after">${escapeText(s.replacement)}</span>`;
  return `<p class="cat-card-line"><s class="cat-reword-before">${escapeText(shown.trim())}</s> → ${after}</p>
        <p class="cat-tsig-note">${escapeText(s.label)} · ${t('a word-for-word edit, no model involved')}</p>
        <div class="cat-card-actions">
          <button type="button" class="btn cat-reword-apply" data-act="reword-suggest" data-idx="${i}">${t('Apply')}</button>
          <button type="button" class="btn-link" data-act="edit-card-close">${t('Keep as is')}</button>
        </div>`;
};
/** One flagged sentence: the model offer, its progress, its alternatives. */
export const rwCardHtml = (dt: DetailsCtx, i: number): string => {
  const { dRewordAlts } = dt;
  const s = dt.dRewordSpans[i];
  if (!s) return '';
  const sentence = (dt.dCleanedText ?? '').slice(s.index, s.index + s.length);
  const alts = dRewordAlts.get(i);
  const altBlock = alts === undefined ? '' : (alts.length
    ? `<ul class="cat-reword-alts">${alts.map((a, j) =>
          `<li><span class="cat-reword-alt">${escapeText(a.text)}</span> <button type="button" class="btn cat-reword-use" data-act="reword-use" data-idx="${i}" data-alt="${j}">${t('Use this')}</button></li>`).join('')}</ul>`
    : `<p class="cat-tsig-note">${t('No better wording survived the checks for this sentence. The original stays.')}</p>`);
  const consent = alts === undefined && dt.dRewordStatus === 'need-download'
    ? `<p class="cat-tsig-note">${escapeText(tRaw('First use downloads the rewriter once (~{mb} MB); it works offline after that.', { mb: Math.round(dt.dRewordBytes / (1024 * 1024)) }))}</p>`
    : '';
  return `<blockquote class="cat-reword-quote">${escapeText(sentence)}</blockquote>
        ${alts === undefined ? `<p class="cat-tsig-note">${t('A small local model can propose a shorter, plainer version. Only versions that keep every fact are offered; accepting one flags the saved copy as AI-assisted.')}</p>` : ''}
        ${consent}
        <div class="cat-card-progress" data-card-progress hidden>
          <span class="job-bar"><span class="job-bar-fill" data-card-fill></span></span>
          <span class="cat-card-progress-label" data-card-label aria-live="polite"></span>
        </div>
        ${altBlock}
        <div class="cat-card-actions">
          <button type="button" class="btn cat-reword-go" data-act="reword-span" data-idx="${i}">${alts === undefined ? t('Suggest rewrites') : t('Try again')}</button>
          <button type="button" class="btn-link" data-act="edit-card-close">${t('Close')}</button>
        </div>`;
};
/** Rebuild the sidebar narration AND the preview from the current working
 *  copy: the signals summary, the fix-characters report, how many inline
 *  edits are marked, and the save actions once the copy differs. The
 *  suggestion/reword DECISIONS happen in the preview itself (the floating
 *  edit card) - this is the one place everything re-derives after each. */
export const renderTextPanel = (dt: DetailsCtx): void => {
  const { cat, dRewordAlts, dlg, isUser } = dt;
  const box = dlg.querySelector<HTMLElement>('[data-tsig]');
  if (!box || dt.dCleanedText == null) return;
  closeEditCard(dt);
  const panel = analyzeVerifyText(dt.dCleanedText, 'digital');
  dt.dAnalysis = panel;
  dt.dSuggestions = suggestRewrites(dt.dCleanedText);
  dt.dRewordSpans = rewordableSpans(dt.dCleanedText, analyzeTextSignals(dt.dCleanedText, { source: 'digital' }).findings);
  const edited = dt.dWorkBase != null && dt.dCleanedText !== dt.dWorkBase;
  box.innerHTML = cat.thumbs.catTextWorkHtml(panel, dt.dHumanizeResult, isUser, {
    suggestions: dt.dSuggestions,
    spans: dt.dRewordSpans,
    alts: dRewordAlts,
    modelTouched: dt.dModelTouched,
    status: dt.dRewordStatus,
    modelBytes: dt.dRewordBytes,
    cleaned: dt.dCleanedText,
  }, edited, dt.dCleanedText.length > 8192);
  box.hidden = false;
  // The preview becomes the working copy: marks + inline edit affordances
  // in place, zoom tools live. The markdown-rendered cache is invalidated
  // so a render-mode toggle re-fills from the edited text.
  dt.dPreviewText = dt.dCleanedText;
  const md = dlg.querySelector<HTMLElement>('[data-md-rendered]');
  if (md) { delete md.dataset.filled; md.replaceChildren(); }
  paintWorkPreview(dt);
  const pill = dlg.querySelector<HTMLElement>('[data-unsaved]');
  if (pill) pill.hidden = !edited;
}; // airy elevation as the asset details rise in (silent on ←/→ paging)

// The Origins row (plans/126 WP-B): the user may know more provenance than
// the file does. State + (for their own assets) a declare control - the
// declaration writes aiGenerated, which the export path already carries as
// a C2PA ingredient, so it follows the asset wherever it is used. DOM-built
// (reflectAiChipInPlace discipline, no raw-HTML sink); re-run after every
// origins change.
export const renderOrigins = (dt: DetailsCtx): void => {
  const { cat, dlg, isUser, ref } = dt;
  const dd = dlg.querySelector<HTMLElement>('[data-origins]');
  if (!dd) return;
  dd.replaceChildren();
  const kind = assetAiKind(ref);
  const declaredByUser = !!(ref.meta as Record<string, unknown> | undefined)?.aiOriginsDeclared;
  const state = document.createElement('span');
  state.className = 'cat-origins-state';
  if (kind) {
    state.appendChild(cat.thumbs.genAiPillEl());
    state.append(` ${kind === 'full' ? t('AI-generated') : t('AI-assisted')}`);
    if (!declaredByUser) state.append(` · ${isUser ? t('read from the file') : t('recorded by the catalog')}`);
  } else {
    state.textContent = t('Not recorded');
  }
  dd.appendChild(state);
  if (isUser) {
    const ctl = document.createElement('span');
    ctl.className = 'cat-origins-ctl';
    const mk = (label: string, act: string, active: boolean): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn cat-origin-btn';
      b.dataset.act = act;
      b.setAttribute('aria-pressed', String(active));
      b.textContent = label;
      return b;
    };
    ctl.append(
      mk(t('AI-generated'), 'origin-full', kind === 'full' && declaredByUser),
      mk(t('AI-assisted'), 'origin-partial', kind === 'partial' && declaredByUser),
    );
    if (declaredByUser) ctl.append(mk(t('Remove declaration'), 'origin-clear', false));
    dd.appendChild(ctl);
    const note = document.createElement('span');
    note.className = 'cat-origins-note';
    note.textContent = t('Declaring origins travels with the asset wherever it is used - so collaborators can talk about the work, not guess about the file.');
    dd.appendChild(note);
  }
};
// ── The provenance passport (plans/136 W2a): one glanceable card - the
// flat lamp strip over an INLINE credential check of the asset's own
// bytes, plus the licensing chips. The check is lazy + stale-guarded like
// the tech panel, and cached per id+version so paging back is free.
export const renderPassport = (dt: DetailsCtx, cred: 'checking' | { found: boolean; state: string; trusted: boolean } | null): void => {
  const { dlg, ref } = dt;
  const box = dlg.querySelector<HTMLElement>('[data-passport]');
  if (!box) return;
  const kind = assetAiKind(ref);
  const sig = ref.meta?.aiSignals as (AiSignalsNote & { at?: string }) | undefined;
  const sigFresh = sig && sig.v === LEXICON_VERSION ? sig : undefined;
  const maker = ref.meta?.makerLikely as { vendor?: string; hint?: string } | undefined;
  const lamps: TrustLamp[] = [
    cred === 'checking'
      ? { id: 'provenance', label: t('Provenance'), state: 'unlit', word: t('checking…') }
      : cred?.found && cred.state === 'invalid'
        ? { id: 'provenance', label: t('Provenance'), state: 'warn', word: t('credential problem'), detail: t('Open Check credentials for the full report.') }
        : cred?.found && cred.trusted
          ? { id: 'provenance', label: t('Provenance'), state: 'fact', word: t('verified') }
          : cred?.found
            ? { id: 'provenance', label: t('Provenance'), state: 'fact', word: t('credential intact') }
            : { id: 'provenance', label: t('Provenance'), state: 'unlit', word: t('none carried'), detail: t('An unlit lamp means that check has nothing to read here - it is not a verdict.') },
    cred === 'checking' || !cred?.found
      ? { id: 'integrity', label: t('Integrity'), state: 'unlit', word: t('nothing to check against') }
      : cred.state === 'valid'
        ? { id: 'integrity', label: t('Integrity'), state: 'fact', word: t('bytes match') }
        : { id: 'integrity', label: t('Integrity'), state: 'warn', word: t('bytes changed') },
    kind
      ? { id: 'origin', label: t('Origin'), state: 'fact', word: kind === 'full' ? t('AI-generated') : t('AI-assisted') }
      : maker?.vendor
        ? { id: 'origin', label: t('Origin'), state: 'hint', word: t('likely AI-made'), detail: tRaw('This file is packaged the way {vendor} AI products package downloads ({hint}). A signal, not proof.', { vendor: maker.vendor, hint: maker.hint ?? '' }) }
        : { id: 'origin', label: t('Origin'), state: 'unlit', word: t('not declared') },
    sigFresh
      ? (sigFresh.band === 'notable' || sigFresh.band === 'strong'
        ? { id: 'signals', label: t('Content signals'), state: 'hint', word: t('signals found'), ...(sigFresh.at ? { detail: tRaw('Analysed {date}.', { date: new Date(sigFresh.at).toLocaleDateString() }) } : {}) }
        : { id: 'signals', label: t('Content signals'), state: 'fact', word: t('none found'), ...(sigFresh.at ? { detail: tRaw('Analysed {date}.', { date: new Date(sigFresh.at).toLocaleDateString() }) } : {}) })
      : { id: 'signals', label: t('Content signals'), state: 'unlit', word: t('not analysed') },
  ];
  const chips: string[] = [];
  const license = (ref.meta as { license?: string } | undefined)?.license;
  if (license) chips.push(`<span class="chip">${escapeText(String(license))}</span>`);
  if ((ref.meta as { brandLock?: boolean } | undefined)?.brandLock) chips.push(`<span class="chip">${escapeText(t('Brand-locked'))}</span>`);
  box.innerHTML = lampStripHtml(lamps, { flat: true }) + (chips.length ? `<div class="cat-passport-chips">${chips.join(' ')}</div>` : '');
  box.hidden = false;
};
// A text asset: fill the reading preview from the asset url after mount (the markup
// was built sync, with a "Loading…" stub). `textContent` escapes, so the file's own
// bytes can never inject markup. The decoded text is cached for "Analyse text".
// Swap the text reading surface between raw monospace and rendered markdown.
// The rendered fill happens once, lazily, and through DOMPurify.sanitize -
// the one raw-HTML sink this feature adds (counted in primitive-guards R10).
export const setTextRenderMode = (dt: DetailsCtx, on: boolean): void => {
  const { dlg } = dt;
  const pre = dlg.querySelector<HTMLElement>('.cat-text-preview');
  const box = dlg.querySelector<HTMLElement>('[data-md-rendered]');
  const btn = dlg.querySelector<HTMLElement>('[data-act="text-render"]');
  if (!pre || !box) return;
  // The fill source tracks what the preview is showing: the working copy
  // once edits exist (dPreviewText), else the asset's own bytes.
  const fillSrc = dt.dPreviewText ?? dt.dTextContent;
  if (on && fillSrc != null && !box.dataset.filled) {
    const capped = fillSrc.length > 262144 ? fillSrc.slice(0, 262144) : fillSrc;
    box.innerHTML = DOMPurify.sanitize(mdToHtml(capped));
    box.dataset.filled = '1';
  }
  pre.hidden = on;
  box.hidden = !on;
  btn?.classList.toggle('is-active', on);
  btn?.setAttribute('aria-pressed', String(on));
};
// ── The working-copy painter (plans/125/127 UX pass) ─────────────────────
// Everything the analysis surfaced becomes VISIBLE and decidable in the
// reading preview: heat marks as before; invisible/format characters as
// small named chips (the byte-level tells are otherwise literally
// unseeable); wording swaps and model-rewordable sentences as clickable
// underlines that open the floating edit card. DOM-built (no markup sink);
// byte-accurate against the raw text, so the rendered-markdown view drops
// back to monospace first. The preview shows the first 8 KB - Apply all in
// the sidebar still covers the whole text.
// The shared invisible-character renderer (lib/invisible-chars.ts) - the
// same chips verify's extract shows, so the two surfaces can never drift.
export const appendVisible = (_dt: DetailsCtx, parent: Node, text: string): void => appendVisibleText(parent, text, 'cat-invis');
export const paintWorkPreview = (dt: DetailsCtx): void => {
  const { dlg } = dt;
  setTextRenderMode(dt, false);
  const pre = dlg.querySelector<HTMLElement>('.cat-text-preview');
  if (!pre || dt.dCleanedText == null || !dt.dAnalysis) return;
  const text = dt.dCleanedText;
  const shown = text.length > 8192 ? text.slice(0, 8192) : text;
  const grade = (b: number): string => b >= 4 ? t('a strong tell') : b === 3 ? t('a moderate signal') : t('a weak hint, safe to ignore');
  // Flat segmentation: every range boundary (marks, swaps, sentences) cuts,
  // so a piece belongs to at most one CLICKABLE range and one mark.
  const clampPos = (v: number): number => Math.max(0, Math.min(shown.length, v));
  const cuts = new Set<number>([0, shown.length]);
  const marks = dt.dAnalysis.marks.filter((m) => m.index < shown.length);
  for (const m of marks) { cuts.add(clampPos(m.index)); cuts.add(clampPos(m.index + m.length)); }
  for (const s of dt.dSuggestions) if (s.index < shown.length) { cuts.add(clampPos(s.index)); cuts.add(clampPos(s.index + s.length)); }
  const rwVisible = dt.dRewordStatus !== 'unstaged';
  if (rwVisible) for (const s of dt.dRewordSpans) if (s.index < shown.length) { cuts.add(clampPos(s.index)); cuts.add(clampPos(s.index + s.length)); }
  const points = [...cuts].sort((x, y) => x - y);
  const rangeAt = (pos: number, ranges: readonly { index: number; length: number }[]): number => {
    for (let k = 0; k < ranges.length; k++) { const r = ranges[k]!; if (pos >= r.index && pos < r.index + r.length) return k; }
    return -1;
  };
  const frag = document.createDocumentFragment();
  for (let p = 0; p + 1 < points.length; p++) {
    const a = points[p]!;
    const b = points[p + 1]!;
    if (b <= a) continue;
    const piece = shown.slice(a, b);
    const sug = rangeAt(a, dt.dSuggestions);
    const rw = rwVisible ? rangeAt(a, dt.dRewordSpans) : -1;
    const mk = marks.find((m) => a >= m.index && a < m.index + m.length);
    let el: HTMLElement | null = null;
    if (sug >= 0) {
      const s = dt.dSuggestions[sug]!;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cat-sug';
      btn.dataset.sug = String(sug);
      btn.title = s.kind === 'delete'
        ? tRaw('{label}: tap to review removing this', { label: s.label })
        : tRaw('{label}: tap to review "{to}"', { label: s.label, to: s.replacement });
      el = btn;
    } else if (rw >= 0) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cat-rw';
      btn.dataset.rw = String(rw);
      btn.title = t('The on-device model can suggest a plainer version of this sentence');
      el = btn;
    } else if (mk?.tier) {
      const markEl = document.createElement('mark');
      const bkt = heatBucket(mk.heat ?? 0);
      markEl.className = `cat-hl cat-hl--${mk.tier} cat-hl--t${bkt}`;
      markEl.title = grade(bkt);
      el = markEl;
    }
    if (el) {
      if ((sug >= 0 || rw >= 0) && mk?.tier) el.classList.add('cat-hl', `cat-hl--t${heatBucket(mk.heat ?? 0)}`);
      appendVisible(dt, el, piece);
      frag.appendChild(el);
    } else {
      appendVisible(dt, frag, piece);
    }
  }
  if (shown.length < text.length) frag.appendChild(document.createTextNode(`\n\n${t('…preview truncated.')}`));
  pre.replaceChildren(frag);
};
export function panelsOps(dt: DetailsCtx) {
  return {
    closeEditCard: bindOp(dt, closeEditCard),
    openEditCard: bindOp(dt, openEditCard),
    sugCardHtml: bindOp(dt, sugCardHtml),
    rwCardHtml: bindOp(dt, rwCardHtml),
    renderTextPanel: bindOp(dt, renderTextPanel),
    renderOrigins: bindOp(dt, renderOrigins),
    renderPassport: bindOp(dt, renderPassport),
    setTextRenderMode: bindOp(dt, setTextRenderMode),
    appendVisible: bindOp(dt, appendVisible),
    paintWorkPreview: bindOp(dt, paintWorkPreview),
  };
}
