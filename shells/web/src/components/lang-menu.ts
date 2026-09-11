// SPDX-License-Identifier: MPL-2.0
/**
 * Language switcher FAB - a bare 32×32 icon (no button chrome, unlike the
 * filter/history FABs) that sits in the gallery-topright cluster on Tools,
 * Catalog, and Projects. Clicking it behaves like the filter FAB: a body-mounted
 * popover menu listing every supported language, current one checked.
 *
 * langFabHtml() renders the trigger; attachLangMenu(trigger, host) wires it.
 * Mirrors profile-menu.ts's conventions (body-mounted popover positioned off the
 * trigger's rect, focus trap, Escape + outside-pointerdown + route-change close)
 * but - unlike that menu - is active at every viewport width, not folded behind
 * a mobile-only gate.
 *
 * A tiny sort toggle sits at the top of the menu - "Speakers" (default) vs
 * "A–Z" - persisted to localStorage 'langSort' and shared with the /info site's
 * nav language menu (same origin, same key).
 */
import { LANG_META, currentLang, switchLang, t, LANG_ICON_SVG, flagEmoji, sortedLangs } from '../i18n.ts';
import type { Lang, LangSwitchHost } from '../i18n.ts';
import { escape } from '../utils.ts';
import { mountBodyPopover } from './body-popover.ts';
import { wireTabs } from '../lib/tabs.ts';

/** Persisted menu-sort preference: 'az' means A–Z; anything else (or a
 *  storage-denied throw) means the most-spoken-first default. */
function langSortPref(): 'speakers' | 'az' {
  try { return localStorage.getItem('langSort') === 'az' ? 'az' : 'speakers'; } catch { return 'speakers'; }
}

/** The trigger button markup - drop directly into a .gallery-topright cluster. */
export function langFabHtml(): string {
  return `<button type="button" class="lang-fab" aria-label="${escape(t('Language'))}" aria-haspopup="menu" aria-expanded="false" title="${escape(t('Language'))}">${LANG_ICON_SVG}</button>`;
}

export function attachLangMenu(triggerEl: HTMLElement | null, host: LangSwitchHost): () => void {
  if (!triggerEl) return () => {};
  const trigger = triggerEl; // const so closures see the narrowed (non-null) type

  let items: HTMLButtonElement[] = [];

  // Views like Tools/Catalog/Projects/Profile pin a fixed bottom bar
  // (.gallery-footer / .profile-footer, shared chrome); the tool view's export
  // sheet (.export-popup) does the same while open. Other views (Dashboard,
  // Verify, the plain tool sidebar) have no such bar. Treat whichever one is
  // actually pinned to the bottom edge right now as the floor the menu must
  // clear, so "avoid the bottom bar" only kicks in on the views that have one.
  function bottomBoundary(vh: number): number {
    let boundary = vh;
    document.querySelectorAll<HTMLElement>('.gallery-footer, .export-popup').forEach(bar => {
      const rect = bar.getBoundingClientRect();
      if (rect.height <= 0 || rect.top >= boundary) return;
      if (rect.bottom < vh - 4) return; // not actually pinned to the bottom edge right now
      const style = getComputedStyle(bar);
      if (style.visibility === 'hidden' || style.display === 'none') return;
      boundary = rect.top;
    });
    return boundary;
  }

  function position(el: HTMLDivElement, anchor: HTMLElement): void {
    const r = anchor.getBoundingClientRect();
    const margin = 8;
    const vh = window.innerHeight;
    el.style.top = `${Math.round(r.bottom + margin)}px`;
    el.style.right = `${Math.max(8, Math.round(window.innerWidth - r.right))}px`;
    // As tall as the language list needs, capped at 90vh, and never crowding
    // into a fixed bottom bar below it.
    const available = bottomBoundary(vh) - r.bottom - margin * 2;
    el.style.maxHeight = `${Math.max(160, Math.min(available, vh * 0.9))}px`;
  }

  function rove(active: HTMLElement, focus = true): void {
    items.forEach(b => { b.tabIndex = b === active ? 0 : -1; });
    if (focus) active.focus();
  }

  const popover = mountBodyPopover(trigger, (el, pop) => {
    const active = currentLang();
    let sort = langSortPref();
    // Flags are decorative garnish (the nativeName is the accessible label), so the
    // flag cluster is aria-hidden. A fixed-width column keeps every name left-aligned
    // whether a language shows one flag or three.
    const flagsHtml = (code: Lang): string => {
      const flags = LANG_META[code].flags ?? [];
      if (!flags.length) return '';
      return `<span class="lang-menu-flags" aria-hidden="true">${flags.map(flagEmoji).join('')}</span>`;
    };
    const listHtml = (s: 'speakers' | 'az'): string => sortedLangs(s).map(code =>
      `<button type="button" class="lang-menu-item" role="menuitemradio" data-lang="${code}" aria-checked="${code === active}">${flagsHtml(code)}<span class="lang-menu-name">${escape(LANG_META[code].nativeName)}</span></button>`,
    ).join('');
    // "A–Z" is deliberately untranslated - it reads the same in every locale.
    el.innerHTML = `<div class="lang-sort-tabs" role="tablist" aria-label="${escape(t('Sort languages'))}">`
      // № prefix lives OUTSIDE the t() key: every locale gets the same
      // "count of" mark, translators only ever see the bare noun.
      + `<button type="button" class="lang-sort-tab" role="tab" data-sort="speakers" aria-selected="${sort === 'speakers'}">№ ${escape(t('Speakers'))}</button>`
      + `<button type="button" class="lang-sort-tab" role="tab" data-sort="az" aria-selected="${sort === 'az'}">A–Z</button>`
      + `</div><div class="lang-menu-list" role="menu" aria-label="${escape(t('Language'))}">${listHtml(sort)}</div>`;

    const list = el.querySelector<HTMLDivElement>('.lang-menu-list')!;
    const collectItems = (): HTMLButtonElement => {
      items = [...el.querySelectorAll<HTMLButtonElement>('.lang-menu-item')];
      return items.find(b => b.getAttribute('aria-checked') === 'true') ?? items[0]!;
    };
    const checked = collectItems();
    rove(checked, false);

    const applySort = (next: 'speakers' | 'az'): void => {
      if (next === sort) return;
      sort = next;
      try { localStorage.setItem('langSort', next); } catch { /* storage denied - session-only */ }
      // Re-render only the list; re-establish the roving tabindex without
      // stealing focus from the clicked sort tab. (The tabs' own aria-selected/
      // tabindex state is applied by wireTabs before this fires.)
      list.innerHTML = listHtml(next);
      rove(collectItems(), false);
    };
    // Shared ARIA-tabs machinery (lib/tabs.ts) - arrow/Home/End roving between
    // the two sort tabs; the initial programmatic select just establishes the
    // single tab stop on the persisted sort.
    const selectSortTab = wireTabs(el.querySelector<HTMLElement>('.lang-sort-tabs')!, {
      key: 'sort',
      onSelect: (value, { reason }) => {
        if (reason !== 'programmatic') applySort(value === 'az' ? 'az' : 'speakers');
      },
    });
    selectSortTab(sort);

    el.addEventListener('click', e => {
      const tab = (e.target as Element).closest<HTMLButtonElement>('.lang-sort-tab');
      if (tab) {
        // wireTabs (listening on the tablist, which fires first) already applied
        // the sort. Browsers that don't focus buttons on click (macOS Safari/
        // Firefox) can leave focus on a just-destroyed list item - falling to
        // <body> would kill the focus trap and arrow keys while the popover is
        // still open.
        if (!el.contains(document.activeElement)) tab.focus();
        return;
      }
      const btn = (e.target as Element).closest<HTMLButtonElement>('[data-lang]');
      if (!btn) return;
      const next = btn.dataset.lang as Lang;
      pop.close();
      void switchLang(host, next);
    });
    el.addEventListener('keydown', e => {
      if (!['ArrowUp', 'ArrowDown'].includes(e.key)) return;
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      if (i < 0) return;
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      rove(items[(i + step + items.length) % items.length]!);
    });

    return checked;
    // The popover root is a plain group: role="menu" lives on .lang-menu-list,
    // because a menu may only own menuitem* children - the sort tablist above
    // the list would be an invalid (and SR-invisible) child of the menu itself.
  }, { className: 'lang-menu', role: 'group', ariaLabel: escape(t('Language')), position });

  const onClick = () => { popover.isOpen() ? popover.close(true) : popover.open(); };
  trigger.addEventListener('click', onClick);

  return () => { popover.close(); trigger.removeEventListener('click', onClick); };
}
