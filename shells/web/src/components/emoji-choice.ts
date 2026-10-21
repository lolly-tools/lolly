// SPDX-License-Identifier: MPL-2.0
/** First-use set selection shared by the popover and the character browser. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { EmojiStyleV1 } from '@lolly-tools/core/emoji-v1';
import { emojiPreferenceFromStyle, setEmojiPreference } from '../lib/emoji-prefs.ts';
import { tRaw } from '../i18n.ts';
import { mountEmojiStyleControl } from './emoji-style-control.ts';

export interface EmojiSelection {
  host: HostV1;
  value(): EmojiStyleV1 | null;
  set(style: EmojiStyleV1): Promise<void>;
}

/** Own async loads so closing, retrying or changing sets cannot mount stale content. */
export async function mountEmojiChoice(
  container: HTMLElement,
  selection: EmojiSelection | undefined,
  mountGrid: (body: HTMLElement) => Promise<() => void>,
  layout: () => void = () => {},
  cancel?: () => void,
): Promise<() => void> {
  let disposed = false, generation = 0;
  let cleanup: (() => void) | undefined;
  const reset = (): number => {
    cleanup?.();
    cleanup = undefined;
    container.replaceChildren();
    return ++generation;
  };
  const button = (label: string, click: () => void): HTMLButtonElement => {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'btn btn--sm'; el.textContent = label;
    el.addEventListener('click', click);
    return el;
  };
  const message = (label: string): void => {
    const p = document.createElement('p'); p.className = 'emoji-choice-message';
    p.setAttribute('role', 'status'); p.textContent = label; container.append(p);
    layout();
  };
  const failed = (mine: number, retry: () => Promise<void>): void => {
    if (disposed || mine !== generation) return;
    reset();
    message(tRaw('Emoji could not load.'));
    container.append(button(tRaw('Try again'), () => { void retry(); }));
    layout();
  };
  const grid = async (): Promise<void> => {
    const mine = reset();
    message(tRaw('Loading…'));
    const body = document.createElement('div');
    container.append(body);
    try {
      const stop = await mountGrid(body);
      if (disposed || mine !== generation) { stop(); return; }
      cleanup = stop;
      container.querySelector('.emoji-choice-message')?.remove();
      if (selection) {
        const change = button(tRaw('Change emoji set'), () => { void choose(); });
        change.classList.add('emoji-change-set');
        container.prepend(change);
      }
      layout();
    } catch { failed(mine, grid); }
  };
  const choose = async (): Promise<void> => {
    if (!selection) { await grid(); return; }
    const mine = reset();
    message(tRaw('Loading…'));
    try {
      const [sets, swatches] = await Promise.all([
        selection.host.emoji?.sets() ?? [], selection.host.tokens?.colors() ?? [],
      ]);
      const palette = swatches.map(swatch => ({ id: swatch.ref, hex: swatch.value }));
      if (disposed || mine !== generation) return;
      container.replaceChildren();
      if (!sets.length) { message(tRaw('No emoji sets are available.')); return; }
      const body = document.createElement('div'); body.className = 'emoji-choice';
      const title = document.createElement('h3'); title.textContent = tRaw('Choose an emoji set');
      const controlBody = document.createElement('div');
      let draft = selection.value();
      const remember = document.createElement('input'); remember.type = 'checkbox'; remember.className = 'field-check';
      remember.checked = !draft;
      const label = document.createElement('label'); label.className = 'emoji-remember';
      label.append(remember, document.createTextNode(tRaw('Use this set for new work')));
      const next = button(tRaw('Continue'), () => {
        if (!draft || next.disabled) return;
        const chosen = draft;
        next.disabled = true;
        void (async () => {
          await selection.set(chosen);
          if (remember.checked) await setEmojiPreference(selection.host, emojiPreferenceFromStyle(chosen));
          if (!disposed && mine === generation) await grid();
        })().catch(() => { failed(mine, choose); });
      });
      next.disabled = !draft;
      const control = mountEmojiStyleControl(controlBody, {
        host: selection.host, mode: 'document', value: draft, sets, palette, compact: true,
        onChange: (value) => {
          draft = value && 'primary' in value ? value : null;
          next.disabled = !draft;
          queueMicrotask(layout);
        },
      });
      cleanup = () => control.destroy();
      body.append(title, controlBody, label, next);
      if (selection.value()) body.append(button(tRaw('Cancel'), () => { void grid(); }));
      else if (cancel) body.append(button(tRaw('Cancel'), cancel));
      container.append(body);
      layout();
      controlBody.querySelector<HTMLElement>('[data-emoji-set]')?.focus();
    } catch { failed(mine, choose); }
  };
  await (selection && !selection.value() ? choose() : grid());
  return () => { disposed = true; reset(); };
}
