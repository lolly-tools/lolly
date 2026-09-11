// SPDX-License-Identifier: MPL-2.0
/**
 * Shared roving-tabindex keyboard machinery for `role="tablist"` tab bars
 * (component audit rec 1). Dashboard's `.dash-tabs` and #/start's `.start-tabs`
 * (and, more loosely, `.color-mode-tabs`) each hand-rolled the identical ARIA
 * tabs pattern - click-to-select, Left/Right/Up/Down arrow + Home/End
 * navigation, one tab stop (`tabindex`) on the strip at a time. This module is
 * that pattern, extracted once.
 *
 * Tab bars are deliberately NOT `.view-seg` (component audit rec 1's other
 * half): a segmented control (lib/seg.ts's `segHtml`) picks a VALUE and uses
 * `aria-pressed`; a tab bar switches between PANELS and uses `aria-selected`.
 * `.is-active` is kept alongside `aria-selected` on every tab as a purely
 * presentational hook for CSS (`.dash-tab.is-active`, `.start-tab.is-active`) - 
 * it carries no semantics of its own and callers should never branch on it.
 */

export type TabSelectReason = 'click' | 'key' | 'programmatic';

export interface WireTabsOptions {
  /** The tab buttons' shared dataset key, camelCase - e.g. `'dashTab'` for
   *  `[data-dash-tab]` / `el.dataset.dashTab`. Matched against `container`'s
   *  descendants (not `container` itself). */
  key: string;
  /** Fires after a tab's DOM state (aria-selected/.is-active/tabindex/focus)
   *  has been applied - owns whatever view-specific side effects follow
   *  (panel visibility, URL sync, sound, closing an unrelated popover, …).
   *  `reason` distinguishes a live user action (`'click'`/`'key'`) from a
   *  programmatic jump (the initial paint, a deep link, "Save & continue") so
   *  callers can e.g. only play a sound or rewrite the URL for the former. */
  onSelect?: (value: string, info: { focus: boolean; reason: TabSelectReason }) => void;
}

/**
 * Wire one tab bar's keyboard + click behaviour inside `container` (the
 * `role="tablist"` element, or any ancestor of the tab buttons - listeners are
 * delegated). Returns a `select(value, opts?)` function for the view's own
 * programmatic jumps (deep links, "next tab" flows); calling it always reports
 * `reason: 'programmatic'` to `onSelect`.
 */
export function wireTabs(container: HTMLElement, options: WireTabsOptions): (value: string, opts?: { focus?: boolean }) => void {
  const attr = `data-${options.key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
  const tabs = [...container.querySelectorAll<HTMLElement>(`[${attr}]`)];
  const noop = (): void => {};
  if (!tabs.length) return noop;

  const valueOf = (el: HTMLElement): string => (el.dataset as Record<string, string | undefined>)[options.key] ?? '';

  const select = (value: string, opts: { focus?: boolean; reason?: TabSelectReason } = {}): void => {
    for (const tabEl of tabs) {
      const on = valueOf(tabEl) === value;
      tabEl.classList.toggle('is-active', on);
      tabEl.setAttribute('aria-selected', String(on));
      tabEl.tabIndex = on ? 0 : -1;
      if (on && opts.focus) tabEl.focus();
    }
    options.onSelect?.(value, { focus: !!opts.focus, reason: opts.reason ?? 'programmatic' });
  };

  container.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(`[${attr}]`);
    if (btn && tabs.includes(btn)) select(valueOf(btn), { reason: 'click' });
  });
  container.addEventListener('keydown', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(`[${attr}]`);
    const i = btn ? tabs.indexOf(btn) : -1;
    if (i < 0) return;
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    select(valueOf(tabs[next]!), { focus: true, reason: 'key' });
  });

  return (value: string, opts: { focus?: boolean } = {}) => select(value, { ...opts, reason: 'programmatic' });
}
