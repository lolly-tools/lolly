// SPDX-License-Identifier: MPL-2.0
/**
 * The view-only banner (plan 75 J5 and section 5.16): a full wash plus a full border,
 * above the tool's inputs, saying the document can be looked at but its changes cannot
 * be saved where it came from, with the one way forward ("Make a copy").
 *
 * The copy arrives already localised (org/team-scope.ts writes it); this component
 * owns placement and announcement only. It is announced once, politely, when it
 * mounts, so it is the first thing a screen reader hears about the document.
 */
import { announce } from '../a11y.ts';
import './viewer-banner.css';

export interface ViewerBannerOptions {
  /** The sentence the banner says. Plain text. */
  message: string;
  /** The action button's label, with its handler. Absent: no button. */
  action?: { label: string; run(): void };
}

export interface ViewerBanner {
  readonly el: HTMLElement;
  /** Say something else (the project's name arrived). Not announced again. */
  update(message: string): void;
  destroy(): void;
}

/**
 * Mount the banner in the tool view: above the inputs in a sidebar layout, else at
 * the top of the stage (an editor layout keeps its inputs elsewhere).
 */
export function mountViewerBanner(view: HTMLElement, opts: ViewerBannerOptions): ViewerBanner {
  const el = document.createElement('div');
  el.className = 'viewer-banner';
  el.setAttribute('role', 'note');
  const text = document.createElement('p');
  text.className = 'viewer-banner-text';
  text.textContent = opts.message;
  el.append(text);
  if (opts.action) {
    const { label, run } = opts.action;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn--sm viewer-banner-action';
    button.dataset.act = 'viewer-make-copy';
    button.textContent = label;
    button.addEventListener('click', () => run());
    el.append(button);
  }
  const inputs = view.querySelector<HTMLElement>('#tool-inputs');
  if (inputs?.parentElement) {
    inputs.parentElement.insertBefore(el, inputs);
  } else {
    el.classList.add('viewer-banner--stage');
    (view.querySelector<HTMLElement>('#tool-stage') ?? view).append(el);
  }
  announce(opts.message);
  return {
    el,
    update(message: string): void {
      if (text.textContent !== message) text.textContent = message;
    },
    destroy(): void {
      el.remove();
    },
  };
}
