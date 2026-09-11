// SPDX-License-Identifier: MPL-2.0
// On-demand input help. Instead of printing every input's help text as an always-
// visible line under each control - which lengthens and clutters a long sidebar - 
// each input gets a small info button next to its label that reveals the help on
// hover (desktop), tap (touch), or keyboard focus. The text stays in the DOM and
// is wired to its control via aria-describedby (see linkHelpDescriptions), so
// screen-reader users still get it even though it is visually on demand.
//
// Mirrors the colour-field popover lifecycle (Escape closes + refocuses the
// trigger, outside-click disarms) so it matches the app's escape-to-close idiom.
import { escape } from '../utils.ts';

const INFO_ICON =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" ' +
  'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';

let _seq = 0;

// The containers a tip's button + pop live inside. Sidebar inputs use .input-row
// / .block-control; anywhere else (e.g. an export-dialog card) opts in with the
// generic .help-tip-host class. Kept in one place so all the .closest() lookups
// and the hover-reveal CSS agree.
const HOST_SEL = '.input-row, .block-control, .help-tip-host';

interface HelpTipLink {
  href: string;
  text?: string;
}

// Returns { button, pop } HTML fragments sharing one id. The button belongs next
// to the label text; the pop is appended as the last child of the row / block
// control (both position:relative) so it spans that element's width and drops
// straight down - it can never overflow the sidebar's clipped right edge.
// `link` (optional) appends one action link after the text, e.g.
// { href: '#/verify', text: 'Check a file' }. The text and href are escaped, and
// an internal `#`/`/` href never opens a new tab; an external http(s) one does.
export function helpTip(text: string, link: HelpTipLink | null = null): { id: string; button: string; pop: string } {
  const id = `helptip-${++_seq}`;
  const button =
    `<button type="button" class="help-tip-btn" aria-label="More info" ` +
    `aria-expanded="false" aria-controls="${id}">${INFO_ICON}</button>`;
  let linkHtml = '';
  if (link && link.href) {
    const external = /^https?:/i.test(link.href);
    // nosemgrep: lolly-href-escape-is-not-scheme-validation - every call site passes a literal in-app route ('#/verify', '#/components'); no remote value reaches it
    linkHtml = ` <a class="help-tip-link" href="${escape(link.href)}"` +
      (external ? ' target="_blank" rel="noopener"' : '') +
      `>${escape(link.text || 'Learn more')}</a>`;
  }
  const pop = `<span class="help-tip-pop" id="${id}" hidden>${escape(text)}${linkHtml}</span>`;
  return { id, button, pop };
}

// Attach-once delegated wiring on the persistent inputs container, so it survives
// the per-keystroke innerHTML rebuilds. Hover reveal is pure CSS; this handles the
// tap toggle, Escape (closes + refocuses the trigger), and outside-click dismiss.
type HelpScope = HTMLElement & {
  _helpTipsWired?: boolean;
  _helpTipDismiss?: (e: MouseEvent) => void;
};

export function wireHelpTips(scope: HelpScope): void {
  if (scope._helpTipsWired) return;
  scope._helpTipsWired = true;

  const btnFor = (pop: Element) =>
    pop.closest(HOST_SEL)?.querySelector<HTMLButtonElement>('.help-tip-btn');

  const closeAll = (except: Element | null) => {
    scope.querySelectorAll<HTMLElement>('.help-tip-pop:not([hidden])').forEach((pop) => {
      if (pop === except) return;
      pop.hidden = true;
      btnFor(pop)?.setAttribute('aria-expanded', 'false');
    });
  };

  scope.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest('.help-tip-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();                 // don't let a wrapping <label> toggle its control
    const pop = btn.closest(HOST_SEL)?.querySelector<HTMLElement>('.help-tip-pop');
    if (!pop) return;
    const willOpen = pop.hidden;
    closeAll(pop);
    pop.hidden = !willOpen;
    btn.setAttribute('aria-expanded', String(willOpen));
  });

  scope.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const pop = scope.querySelector<HTMLElement>('.help-tip-pop:not([hidden])');
    if (!pop) return;
    pop.hidden = true;
    const btn = btnFor(pop);
    btn?.setAttribute('aria-expanded', 'false');
    btn?.focus();
    e.stopPropagation();
  });

  // Outside-click dismiss (capture, like the colour popover) - stored on the scope
  // so the view teardown can drop it and not pin a detached tree alive.
  scope._helpTipDismiss = (e: MouseEvent) => {
    if (!(e.target as Element).closest('.help-tip-btn, .help-tip-pop')) closeAll(null);
  };
  document.addEventListener('click', scope._helpTipDismiss, true);
}

// Point each control at its help text for assistive tech. Runs every render (the
// controls are recreated on each rebuild); cheap - only a handful of pops exist.
export function linkHelpDescriptions(scope: HTMLElement): void {
  scope.querySelectorAll<HTMLElement>('.help-tip-pop[id]').forEach((pop) => {
    const row = pop.closest(HOST_SEL);
    const ctrl = row?.querySelector('input, select, textarea, [data-field-id], [data-input-id]');
    if (ctrl && !ctrl.hasAttribute('aria-describedby')) {
      ctrl.setAttribute('aria-describedby', pop.id);
    }
  });
  // Notices (`input.notice` - the always-visible consent-gate fine print) are
  // aria-hidden in the row markup so they don't bloat the wrapping label's
  // accessible NAME; referencing them from aria-describedby still exposes their
  // text as the control's description (accname traversal includes referenced
  // hidden nodes). Append rather than overwrite so a help pop and a notice
  // can describe the same control.
  scope.querySelectorAll<HTMLElement>('.input-notice[id]').forEach((note) => {
    const row = note.closest(HOST_SEL);
    const ctrl = row?.querySelector('input, select, textarea, [data-field-id], [data-input-id]');
    if (!ctrl) return;
    const existing = ctrl.getAttribute('aria-describedby');
    if (!existing) ctrl.setAttribute('aria-describedby', note.id);
    else if (!existing.split(/\s+/).includes(note.id)) ctrl.setAttribute('aria-describedby', `${existing} ${note.id}`);
  });
}
