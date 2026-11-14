// SPDX-License-Identifier: MPL-2.0
/**
 * A make-panel button that shows what its action is doing (#/music's Save to library and
 * Download): while the work runs the button is disabled with a small turning ring and a
 * word for the work ("Saving…"); when it is done the button shows a tick and a word
 * ("Saved") for three seconds, then goes back; when it fails a short plain sentence
 * appears beside the button, and the button reads it as its description. The view's
 * status line keeps saying the full result for screen readers. The ring stands still
 * under reduced motion (parts/music-studio.css). A button can rest with a glyph of its
 * own (Download's arrow), keep a caret after its words, and, inside a pill, put its
 * failure after the pill.
 */
import { t } from '../../i18n.ts';
import { iconNode } from '../../lib/icon-node.ts';
import type { IconName } from '../../lib/icons.ts';

/** How long the "done" state shows before the button goes back. */
const DONE_MS = 3000;
/** Each button's failure line gets an id of its own, for aria-describedby. */
let errorSeq = 0;

export interface ActionButton {
  /** Run `work` with the button busy. Resolves null when the work finished, or the plain
   *  sentence shown beside the button when it failed. */
  run(work: () => Promise<void>): Promise<string | null>;
  /** Back to rest at once (the view going away). */
  reset(): void;
}

/** A failure whose message is already plain words for the person, shown as it is. */
export class PlainFailure extends Error {}

/**
 * A failure in words a person can act on. WebKit's private windows refuse to keep a file
 * in IndexedDB ("UnknownError: Error preparing Blob/File data to be stored in object
 * store"), and a full disk is a QuotaExceededError; anything else gets the plain fallback.
 */
export function plainFailure(err: unknown, fallback: string): string {
  if (err instanceof PlainFailure) return err.message;
  const text = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  if (/Blob\/File data|preparing Blob|object store/i.test(text)) return t('This browser would not store the tune. A private window cannot keep files.');
  if (/QuotaExceeded|quota/i.test(text)) return t('There is no room left on this device to store the tune.');
  return fallback;
}

export interface ActionWords {
  busy: string;
  done: string;
  failed: string;
  /** The glyph the button shows at rest, if any. */
  rest?: IconName;
  /** A glyph that stays after the words in every state (the caret of a button that opens a menu). */
  trail?: IconName;
  /** Where the failure sentence goes: after this element (a pill the button sits in), or after the button. */
  errorAfter?: HTMLElement;
}

export function actionButton(btn: HTMLButtonElement, words: ActionWords): ActionButton {
  const rest = { label: btn.textContent?.trim() ?? '' };
  const icon = document.createElement('span');
  icon.className = 'ms-act-icon';
  icon.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.className = 'ms-act-label';
  label.textContent = rest.label;
  btn.replaceChildren(icon, label);
  if (words.trail) {
    const trail = document.createElement('span');
    trail.className = 'ms-act-trail';
    trail.setAttribute('aria-hidden', 'true');
    const g = iconNode(words.trail);
    if (g) trail.append(g);
    btn.append(trail);
  }
  btn.classList.add('ms-act');
  const error = document.createElement('span');
  error.className = 'ms-act-error';
  error.id = `ms-act-error-${++errorSeq}`;
  error.hidden = true;
  (words.errorAfter ?? btn).after(error);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const show = (state: 'rest' | 'busy' | 'done' | 'failed', text: string, glyph: IconName | 'ring' | null): void => {
    btn.dataset.state = state;
    label.textContent = text;
    icon.replaceChildren();
    if (glyph === 'ring') icon.append(Object.assign(document.createElement('span'), { className: 'ms-act-ring' }));
    else if (glyph) { const g = iconNode(glyph); if (g) icon.append(g); }
    icon.hidden = !glyph;
  };
  const reset = (): void => {
    clearTimeout(timer);
    show('rest', rest.label, words.rest ?? null);
    btn.removeAttribute('aria-busy');
  };
  reset();

  return {
    reset,
    async run(work) {
      clearTimeout(timer);
      error.hidden = true;
      error.textContent = '';
      btn.removeAttribute('aria-describedby');
      const was = btn.disabled;
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      show('busy', words.busy, 'ring');
      try {
        await work();
        btn.removeAttribute('aria-busy');
        btn.disabled = was;
        show('done', words.done, 'check');
        timer = setTimeout(reset, DONE_MS);
        return null;
      } catch (err) {
        btn.removeAttribute('aria-busy');
        btn.disabled = was;
        show('failed', rest.label, 'alert');
        const message = plainFailure(err, words.failed);
        error.textContent = message;
        error.hidden = false;
        btn.setAttribute('aria-describedby', error.id);
        return message;
      }
    },
  };
}
