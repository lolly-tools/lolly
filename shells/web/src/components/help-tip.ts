// On-demand input help. Instead of printing every input's help text as an always-
// visible line under each control — which lengthens and clutters a long sidebar —
// each input gets a small info button next to its label that reveals the help on
// hover (desktop), tap (touch), or keyboard focus. The text stays in the DOM and
// is wired to its control via aria-describedby (see linkHelpDescriptions), so
// screen-reader users still get it even though it is visually on demand.
//
// Mirrors the colour-field popover lifecycle (Escape closes + refocuses the
// trigger, outside-click disarms) so it matches the app's escape-to-close idiom.

const INFO_ICON =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" ' +
  'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ESCAPES[c] ?? c);

let _seq = 0;

// Returns { button, pop } HTML fragments sharing one id. The button belongs next
// to the label text; the pop is appended as the last child of the row / block
// control (both position:relative) so it spans that element's width and drops
// straight down — it can never overflow the sidebar's clipped right edge.
export function helpTip(text: string): { id: string; button: string; pop: string } {
  const id = `helptip-${++_seq}`;
  const button =
    `<button type="button" class="help-tip-btn" aria-label="More info" ` +
    `aria-expanded="false" aria-controls="${id}">${INFO_ICON}</button>`;
  const pop = `<span class="help-tip-pop" id="${id}" hidden>${esc(text)}</span>`;
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
    pop.closest('.input-row, .block-control')?.querySelector<HTMLButtonElement>('.help-tip-btn');

  const closeAll = (except: Element | null) => {
    scope.querySelectorAll<HTMLElement>('.help-tip-pop:not([hidden])').forEach((pop) => {
      if (pop === except) return;
      pop.hidden = true;
      btnFor(pop)?.setAttribute('aria-expanded', 'false');
    });
  };

  scope.addEventListener('click', (e) => {
    const btn = e.target instanceof Element ? e.target.closest('.help-tip-btn') : null;
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();                 // don't let a wrapping <label> toggle its control
    const pop = btn.closest('.input-row, .block-control')?.querySelector<HTMLElement>('.help-tip-pop');
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

  // Outside-click dismiss (capture, like the colour popover) — stored on the scope
  // so the view teardown can drop it and not pin a detached tree alive.
  const dismiss = (e: MouseEvent) => {
    if (!(e.target instanceof Element) || !e.target.closest('.help-tip-btn, .help-tip-pop')) closeAll(null);
  };
  scope._helpTipDismiss = dismiss;
  document.addEventListener('click', dismiss, true);
}

// Point each control at its help text for assistive tech. Runs every render (the
// controls are recreated on each rebuild); cheap — only a handful of pops exist.
export function linkHelpDescriptions(scope: HTMLElement): void {
  scope.querySelectorAll<HTMLElement>('.help-tip-pop[id]').forEach((pop) => {
    const row = pop.closest('.input-row, .block-control');
    const ctrl = row?.querySelector('input, select, textarea, [data-field-id], [data-input-id]');
    if (ctrl && !ctrl.hasAttribute('aria-describedby')) {
      ctrl.setAttribute('aria-describedby', pop.id);
    }
  });
}
