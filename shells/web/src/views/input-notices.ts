// SPDX-License-Identifier: MPL-2.0
/**
 * Input notices in the sidebar (engine 1.358). A hook can say something about an
 * input (`inputNotices` in its result), and this module draws that message under
 * the input's control, in the look of the row's fine print (`.input-notice`).
 *
 * This is a pass over the panel that is already on the page, not part of the
 * panel's markup: the panel skips its rebuild on most keystrokes, and a notice
 * changes on exactly those keystrokes. The pass is idempotent, so it runs after
 * every sync whether or not the panel was rebuilt.
 *
 * A notice inside a folded section marks the section head with a dot. The fold
 * is the user's and is left as it stands.
 */
import { announce } from '../a11y.ts';
import { t } from '../i18n.ts';

interface Notice { tone: 'info' | 'warning' | 'error'; text: string }
type Notices = Readonly<Record<string, Notice>>;

const NOTE_CLASS = 'input-notice--hook';
const MARK_CLASS = 'input-section-mark';
/** The same controls help-tip.ts describes, so a notice describes the element a help tip would. */
const CONTROL_SEL = 'input:not(.is-upgraded), select, textarea, [data-field-id]:not(.is-upgraded), [data-input-id]:not(.is-upgraded), [role="slider"]';
const RANK = { info: 1, warning: 2, error: 3 } as const;

/** What each panel last announced, so a repaint with the same notices stays silent. */
const spoken = new WeakMap<HTMLElement, Map<string, string>>();

const noteId = (inputId: string): string => `inotice-hook-${inputId.replace(/[^\w-]/g, '_')}`;

function rowOf(panel: HTMLElement, inputId: string): HTMLElement | null {
  for (const node of panel.querySelectorAll<HTMLElement>('[data-input-id]')) {
    if (node.dataset.inputId === inputId) return node.closest<HTMLElement>('.input-row');
  }
  return null;
}

/** Fired on the panel after each pass, for chrome that counts the notices on show (the phone sheet's chip). */
export const INPUT_NOTICES_EVENT = 'lolly:input-notices';

/** The control of a row that takes focus and carries the row's descriptions. */
export function noticeControl(row: HTMLElement): HTMLElement | null {
  // A colour row's field is a hidden input behind the swatch button, and the button is what takes focus.
  return row.querySelector<HTMLElement>('.color-trigger') ?? row.querySelector<HTMLElement>(CONTROL_SEL);
}

function describe(row: HTMLElement, id: string, on: boolean): void {
  const control = noticeControl(row);
  if (!control) return;
  const ids = (control.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean).filter((x) => x !== id);
  if (on) ids.push(id);
  if (ids.length) control.setAttribute('aria-describedby', ids.join(' '));
  else control.removeAttribute('aria-describedby');
}

/**
 * Show `notices` in `panel`, replacing whatever the last pass drew. An input with
 * no row on the page (hidden by its `showIf`, or attached nowhere) shows nothing.
 */
export function applyInputNotices(panel: HTMLElement, notices: Notices | undefined): void {
  const want = notices ?? {};
  const kept = new Set<string>();
  const shown = new Map<string, string>();

  for (const [inputId, notice] of Object.entries(want)) {
    const row = rowOf(panel, inputId);
    if (!row) continue;
    const id = noteId(inputId);
    let note = row.querySelector<HTMLElement>(`:scope > .${NOTE_CLASS}`);
    if (!note) {
      note = document.createElement('span');
      note.className = `input-notice ${NOTE_CLASS}`;
      // Out of the wrapping label's accessible name. aria-describedby still reads the text.
      note.setAttribute('aria-hidden', 'true');
      row.append(note);
    }
    if (note.id !== id) note.id = id;
    if (note.dataset.tone !== notice.tone) note.dataset.tone = notice.tone;
    if (note.textContent !== notice.text) note.textContent = notice.text;
    describe(row, id, true);
    kept.add(id);
    const label = row.querySelector('.input-label-text')?.firstChild?.textContent?.trim();
    shown.set(inputId, `${label ? `${label}: ` : ''}${notice.text}`);
  }

  for (const stale of panel.querySelectorAll<HTMLElement>(`.${NOTE_CLASS}`)) {
    if (kept.has(stale.id)) continue;
    const row = stale.closest<HTMLElement>('.input-row');
    if (row) describe(row, stale.id, false);
    stale.remove();
  }

  // One dot on the head of each section that holds a notice, in the strongest tone inside.
  for (const section of panel.querySelectorAll<HTMLElement>('details.input-section')) {
    const summary = section.querySelector<HTMLElement>(':scope > .input-section-summary');
    if (!summary) continue;
    const inside = [...section.querySelectorAll<HTMLElement>(`.${NOTE_CLASS}`)];
    let mark = summary.querySelector<HTMLElement>(`.${MARK_CLASS}`);
    if (!inside.length) { mark?.remove(); continue; }
    const tone = inside.map((n) => n.dataset.tone as Notice['tone']).reduce((a, b) => (RANK[b] > RANK[a] ? b : a));
    const words = inside.length === 1 ? t('1 notice') : t('{n} notices', { n: inside.length });
    if (!mark) {
      mark = document.createElement('span');
      mark.className = MARK_CLASS;
      mark.setAttribute('role', 'img');
      summary.append(mark);
    }
    if (mark.dataset.tone !== tone) mark.dataset.tone = tone;
    if (mark.getAttribute('aria-label') !== words) { mark.setAttribute('aria-label', words); mark.title = words; }
  }

  // The event class of the panel's own document, which is the page's in a browser.
  const PanelEvent = panel.ownerDocument.defaultView?.Event ?? Event;
  panel.dispatchEvent(new PanelEvent(INPUT_NOTICES_EVENT, { bubbles: true }));

  // Say what is new or changed, once. A notice that went away is not announced, and
  // neither is what a panel opens with: the page is still announcing its own arrival,
  // and each line is read as its control's description on focus.
  const before = spoken.get(panel);
  spoken.set(panel, shown);
  if (!before) return;
  const fresh = [...shown].filter(([inputId, line]) => before.get(inputId) !== line).map(([, line]) => line);
  if (fresh.length) announce(fresh.join(' '));
}
