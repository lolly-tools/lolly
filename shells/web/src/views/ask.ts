// SPDX-License-Identifier: MPL-2.0
/**
 * Ask Lolly (#/ask) - the in-app help surface (plans/103 M0).
 *
 * A routed utility view like the Colour Lab or Script Audio: no tab, the shared
 * back pill, and its OWN composer rather than the shell search bar. You type a
 * question; the answer is a VERBATIM documentation section (extracted full text,
 * not the search snippet) with a citation and an open-in-docs link, followed by
 * any in-app places the same query matches (tools, settings, projects…) as
 * navigate-only buttons. Nothing is generated - the words are the docs' own.
 *
 * The transcript is session memory (lib/ask/session.ts): it survives a spotlight
 * → #/ask re-ask and a Back into the view, and dies on reload. A #/ask?q= seed
 * (from the spotlight "Ask Lolly:" row) is asked once on mount; the composer then
 * answers in place without touching the URL - the hash is the entry seed only.
 */
import '../styles/parts/ask.css';
import { escape, safeHref } from '../utils.ts';
import { icon } from '../lib/icons.ts';
import { t, tRaw, docsAppHref } from '../i18n.ts';
import { armViewEnter } from '../view-enter.ts';
import { backHomeHtml, mountBackPill } from '../components/back-pill.ts';
import { createThemeToggle } from '../components/theme-toggle.ts';
import { attachProfileMenu } from '../components/profile-menu.ts';
import { mountHomeFab } from '../components/home-fab.ts';
import { LOLLY_MARK_SVG } from '../lib/lolly-mark.ts';
import { GROUP_LABELS, type SearchGroupId } from '../lib/search/registry.ts';
import { docsIconName } from '../lib/search/providers/docs.ts';
import { docsAppHrefFor } from '../lib/search/docs-index.ts';
import { askSession, pushTurn, type AskTurn } from '../lib/ask/session.ts';
import { answerQuestion, type AskAnswer } from '../lib/ask/answer.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';

/** The Ask view drives the theme toggle + forwards the host to the provider
 *  registrar; HostV1 covers both. */
type AskHost = HostV1;

/** A question long enough to be worth answering (mirrors MIN_QUERY_LENGTH). */
const MIN_LEN = 2;

/** Session memory for the M1 consent chip - a dismissal holds until reload,
 *  like the transcript itself. */
let embedConsentDismissed = false;

/** The answer HTML for one turn - reused for the live "thinking" placeholder. */
function answerCardHtml(answer: AskAnswer): string {
  const parts: string[] = [];

  if (answer.primary) {
    const { html, citation, href, fromSnippet } = answer.primary;
    const cite = citation.heading
      ? `${escape(citation.pageTitle)} › ${escape(citation.heading)}`
      : escape(citation.pageTitle);
    const openDocs = safeHref(href)
      // nosemgrep: lolly-href-escape-is-not-scheme-validation - safeHref()-gated above; an unsafe doc href drops the link and keeps the bare citation
      ? ` · <a href="${escape(href)}" class="ask-cite-link">${t('Open in docs')}</a>`
      : '';
    parts.push(`<div class="ask-answer-body${fromSnippet ? ' is-snippet' : ''}">
        <div class="ask-section" data-section>${html}</div>
        <button type="button" class="ask-more" data-more hidden>${t('Show more')}</button>
        <p class="ask-cite">${cite}${openDocs}</p>
      </div>`);
  }

  // The page the answer already came from - related sections ON that page don't
  // need the page-title subtitle (it just repeats), and its bare page-intro row
  // is redundant with the "Open in docs" link above. The page name is kept only
  // where a related section lives on a DIFFERENT page, where it is real context.
  const primaryPage = answer.primary?.citation.page ?? null;
  const relatedRecs = answer.related.filter((rec) => !(rec.p === primaryPage && rec.h === ''));
  if (relatedRecs.length) {
    const rows = relatedRecs.map((rec) => {
      const label = rec.h || rec.t;
      const samePage = rec.p === primaryPage;
      const sub = rec.h && !samePage ? ` <span class="ask-related-sub">${escape(rec.t)}</span>` : '';
      // Route to the in-app reader (#/docs/<slug>?h=<anchor>) - same-app hash nav,
      // not the /info share page; the anchor rides ?h= (a second '#' can't).
      const href = docsAppHrefFor(rec);
      // nosemgrep: lolly-href-escape-is-not-scheme-validation - fixed-prefix in-app route ('#/docs/…'); escape() here only neutralises attribute quotes
      return `<li><a href="${escape(href)}" class="ask-related-link"><span class="ask-related-icon" aria-hidden="true">${icon(docsIconName(rec.i))}</span><span>${escape(label)}${sub}</span></a></li>`;
    }).join('');
    parts.push(`<div class="ask-related"><p class="ask-group-label">${t('More in the docs')}</p><ul>${rows}</ul></div>`);
  }

  for (const group of answer.toolHits) {
    const label = t(GROUP_LABELS[group.group as SearchGroupId]);
    const rows = group.hits.filter((hit) => safeHref(hit.href)).map((hit) => {
      const sub = hit.subtitle ? `<span class="ask-hit-sub">${escape(hit.subtitle)}</span>` : '';
      // nosemgrep: lolly-href-escape-is-not-scheme-validation - safeHref()-gated by the .filter() above; an unsafe hit href is dropped, never painted
      return `<a href="${escape(hit.href)}" class="ask-hit" data-sfx="navigate">
          <span class="ask-hit-icon" aria-hidden="true">${hit.icon}</span>
          <span class="ask-hit-text"><span class="ask-hit-title">${escape(hit.title)}</span>${sub}</span>
        </a>`;
    }).join('');
    if (!rows) continue;
    parts.push(`<div class="ask-hits"><p class="ask-group-label">${escape(label)}</p><div class="ask-hit-list">${rows}</div></div>`);
  }

  if (!parts.length) {
    parts.push(`<p class="ask-empty">${t('I could not find anything for that. Try rephrasing, or browse the documentation.')}
      <a href="${docsAppHref('index')}" class="ask-cite-link">${t('Open the docs')}</a></p>`);
  }

  return `<div class="ask-answer" role="group">${parts.join('')}</div>`;
}

/** One transcript turn → HTML (a question bubble or an answer card). */
function turnHtml(turn: AskTurn): string {
  if (turn.role === 'user') {
    return `<div class="ask-turn ask-turn-user"><p class="ask-q">${escape(turn.q)}</p></div>`;
  }
  return `<div class="ask-turn ask-turn-answer">${answerCardHtml(turn.answer)}</div>`;
}

export async function mountAsk(viewEl: HTMLElement, host: AskHost, params: string): Promise<void> {
  document.title = tRaw('{name} - Lolly', { name: t('Ask Lolly') });

  // Ensure the spotlight providers are registered - the overlay registers them
  // lazily on its first query, which may not have happened if the user came
  // straight to #/ask. registerProvider is id-idempotent, so this is safe even
  // when the overlay already did it.
  try {
    const { registerDefaultProviders } = await import('../lib/search/providers/index.ts');
    registerDefaultProviders(host);
  } catch { /* provider chunk failed → no tool hits, docs answers still work */ }
  if (!viewEl.isConnected) return;

  viewEl.innerHTML = `
    ${backHomeHtml()}
    <div class="ask-topright" data-topright>
      <a href="#/profile" class="ask-top-btn ask-profile-link" aria-label="${escape(t('Open your profile'))}" title="${escape(t('Profile'))}">${icon('user')}</a>
    </div>
    <div class="platform-layout ask-layout">
      <header class="plat-header">
        <h1 class="plat-title">${t('Ask Lolly')}</h1>
        <div class="plat-header-text">
          <p class="plat-sub">${t('Answers come from the docs, nothing you write leaves this device')}</p>
        </div>
      </header>
      <div class="ask-transcript" data-transcript aria-live="polite"></div>
      <form class="ask-composer" data-composer>
        <input type="text" class="field-input ask-input" data-input autocomplete="off"
          aria-label="${escape(t('Your question'))}"
          placeholder="${escape(t('How do I export a transparent PNG?'))}">
        <button type="submit" class="ask-send" data-send>
          <span class="ask-send-mark" aria-hidden="true">${LOLLY_MARK_SVG}</span>
          <span class="ask-send-label">${t('Ask')}</span>
        </button>
      </form>
    </div>`;
  armViewEnter(viewEl, '.plat-header, .ask-composer');
  mountBackPill(viewEl);
  mountHomeFab(viewEl);
  // The theme switcher (icon-only cycle: light → dark → brand), styled locally as
  // .ask-top-btn - the profile link sits beside it (both top-right).
  viewEl.querySelector('[data-topright]')?.prepend(createThemeToggle(host, { className: 'ask-top-btn ask-theme-btn' }));
  // On mobile the profile pill becomes the consolidated menu (theme / Home /
  // Language / settings) and the standalone home FAB hides (overrides.css) -
  // one stable anchor instead of the wandering top-left fab. Desktop unchanged.
  const detachProfileMenu = attachProfileMenu(viewEl.querySelector<HTMLElement>('.ask-profile-link'), host);

  const transcriptEl = viewEl.querySelector<HTMLElement>('[data-transcript]')!;
  const inputEl = viewEl.querySelector<HTMLInputElement>('[data-input]')!;
  const formEl = viewEl.querySelector<HTMLFormElement>('[data-composer]')!;

  // `#/ask?bench` arms the retrieval timing logs (plans/103 section 5) for this
  // mount only; the cleanup below disarms it.
  const benchOn = new URLSearchParams(params).has('bench');
  if (benchOn) (globalThis as Record<string, unknown>).__lollyAskBench = true;

  // ── M1 consent chip - "better matching" is a ~23 MB opt-in, never implicit ──
  // Offered under the transcript once at least one answer exists, when the
  // build stages the embed model and it is not on-device yet. All three facts
  // are probed lazily so Tier 0 pays nothing.
  const consentEl = document.createElement('div');
  consentEl.className = 'ask-consent';
  consentEl.hidden = true;
  transcriptEl.insertAdjacentElement('afterend', consentEl);
  let consentBusy = false;
  /** Unsubscribes this view from the download job's progress fan-out. */
  let detachDownload: (() => void) | null = null;
  const offerConsent = async (): Promise<void> => {
    if (embedConsentDismissed || consentBusy || !askSession().length) return;
    try {
      const { cachedEmbedModel, EMBED_MODEL_BYTES } = await import('../lib/ask/embed.ts');
      const { downloadEmbedModel, embedDownloadActive } = await import('../lib/ask/embed-download.ts');
      const { fetchPrecacheManifest } = await import('../lib/offline-manager.ts');
      const precache = await fetchPrecacheManifest();
      if (!viewEl.isConnected || !precache?.groups.embed?.length || (await cachedEmbedModel())) return;
      if (consentEl.dataset.wired) { consentEl.hidden = false; return; }
      consentEl.dataset.wired = '1';
      const mb = Math.round(EMBED_MODEL_BYTES / 1024 / 1024);
      consentEl.innerHTML = `
        <span class="ask-consent-text">${tRaw('Better matching: a small on-device model ({n} MB) helps pair questions with the right section. It stays on this device.', { n: mb })}</span>
        <button type="button" class="btn ask-consent-get" data-consent-get>${t('Download')}</button>
        <button type="button" class="btn-link ask-consent-no" data-consent-no>${t('Not now')}</button>`;
      consentEl.hidden = false;
      consentEl.querySelector('[data-consent-no]')?.addEventListener('click', () => {
        embedConsentDismissed = true;
        consentEl.hidden = true;
      });
      // The chip is now a MIRROR, not the owner: lib/ask/embed-download.ts runs
      // the ~23 MB fetch as a WP-F job, so it keeps going (and stays visible in
      // the global toast, with a working ✕) after this view is torn down. Every
      // callback here checks isConnected, because by then it may be writing into
      // a detached node.
      const mirror = (text: HTMLElement): (() => void) => {
        const { detach } = downloadEmbedModel(precache, {
          onProgress: (loaded, total) => {
            if (!viewEl.isConnected) return;
            const pct = total ? Math.round((loaded / total) * 100) : 0;
            text.textContent = tRaw('Downloading the matching model, {n}%', { n: pct });
          },
          onDone: () => {
            consentBusy = false;
            if (!viewEl.isConnected) return;
            text.textContent = t('Ready. Your next question uses it.');
            setTimeout(() => { consentEl.hidden = true; }, 4000);
          },
          onError: () => {
            consentBusy = false;
            if (!viewEl.isConnected) return;
            text.textContent = t('The download did not finish. Answers keep working without it.');
            setTimeout(() => { consentEl.hidden = true; }, 4000);
          },
        });
        return detach;
      };
      /** Put the chip in its downloading state and attach it to the job. */
      const showDownloading = (): void => {
        consentBusy = true;
        const text = consentEl.querySelector<HTMLElement>('.ask-consent-text')!;
        for (const b of consentEl.querySelectorAll('button')) (b as HTMLButtonElement).hidden = true;
        detachDownload?.();
        detachDownload = mirror(text);
      };
      consentEl.querySelector('[data-consent-get]')?.addEventListener('click', () => {
        if (consentBusy) return;
        showDownloading();
      });
      // Coming back to #/ask mid-download: the model is still uncached, so the
      // chip re-offers itself. Attach to the running job instead of starting a
      // second download of the same bytes.
      if (embedDownloadActive()) showDownloading();
    } catch { /* the chip is an enhancement - its absence is never an error */ }
  };

  // Cap long sections and reveal the "Show more" control only where it overflows.
  const wireExpanders = (): void => {
    for (const body of transcriptEl.querySelectorAll<HTMLElement>('.ask-answer-body')) {
      const section = body.querySelector<HTMLElement>('[data-section]');
      const more = body.querySelector<HTMLButtonElement>('[data-more]');
      if (!section || !more) continue;
      if (section.scrollHeight > section.clientHeight + 4) more.hidden = false;
    }
  };

  const render = (pending?: string): void => {
    const turns = askSession().map(turnHtml).join('');
    const thinking = pending !== undefined
      ? `<div class="ask-turn ask-turn-user"><p class="ask-q">${escape(pending)}</p></div>
         <div class="ask-turn ask-turn-answer"><div class="ask-answer ask-thinking">${t('Looking through the docs…')}</div></div>`
      : '';
    transcriptEl.innerHTML = turns + thinking;
    wireExpanders();
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  };
  render();

  let busy = false;
  const ask = async (raw: string): Promise<void> => {
    const q = raw.trim();
    if (busy || q.length < MIN_LEN) return;
    busy = true;
    render(q); // question + a "thinking" placeholder
    try {
      const answer = await answerQuestion(q);
      if (!viewEl.isConnected) return;
      pushTurn({ role: 'user', q });
      pushTurn({ role: 'answer', answer });
    } finally {
      busy = false;
      if (viewEl.isConnected) { render(); void offerConsent(); }
    }
  };
  if (askSession().length) void offerConsent();

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = inputEl.value;
    inputEl.value = '';
    void ask(q);
  });

  // "Show more" toggles a section open (event delegation - the transcript is
  // re-rendered wholesale, so per-button listeners would leak).
  transcriptEl.addEventListener('click', (e) => {
    const more = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-more]');
    if (!more) return;
    const body = more.closest('.ask-answer-body');
    body?.querySelector('[data-section]')?.classList.add('is-open');
    more.hidden = true;
  });

  // Seed from #/ask?q= - asked once. A seed already present in the transcript
  // (a Back into the view, a same-question re-mount) never re-fires.
  const seed = new URLSearchParams(params).get('q')?.trim() ?? '';
  const alreadyAsked = askSession().some((turn) => turn.role === 'user' && turn.q === seed);
  if (seed.length >= MIN_LEN && !alreadyAsked) {
    void ask(seed);
  } else {
    inputEl.focus();
  }

  (viewEl as HTMLElement & { _cleanup?: () => void })._cleanup = () => {
    busy = false;
    detachProfileMenu();
    // Detach the chip's mirror only. The download job carries on - that is the
    // whole point of moving it out of this view - and the toast still shows it.
    detachDownload?.();
    detachDownload = null;
    if (benchOn) delete (globalThis as Record<string, unknown>).__lollyAskBench;
  };
}
