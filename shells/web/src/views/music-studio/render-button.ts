// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator's Render button (#/music): one button that opens Render's choices
 * (views/music-studio/choice-menu.ts): render and play, or download the track as M4A or
 * WAV. A choice renders the whole track at full quality first when the track has not
 * been rendered (the view's render card shows the progress); once it has, the button
 * reads Rendered with a tick and every choice is immediate. Under the choices, a line
 * says what every download records (lib/tune-provenance.ts), so the record is in view
 * at the moment of choosing: every download carries Content Credentials and the plain
 * description, with no switch to leave them out (Andy, 2026-11-14). A download's
 * progress, its tick and a failure show on the button itself
 * (views/music-studio/action-button.ts).
 */
import { t, tRaw } from '../../i18n.ts';
import { escape as escapeHtml } from '../../utils.ts';
import { TUNE_DECLARATION } from '../../../../../engine/src/tune-provenance.ts';
import { actionButton } from './action-button.ts';
import { wireChoiceMenu, type MenuChoice } from './choice-menu.ts';

export type RenderChoice = 'play' | 'm4a' | 'wav';

/** The button: one word, and the caret the action button adds. */
export function renderButtonHtml(): string {
  return `<button type="button" class="ms-render" data-render title="${escapeHtml(t('Render the whole track at full quality, to play or download'))}">${escapeHtml(t('Render'))}</button>`;
}

/** What every download records: the line under Render's choices. */
export function downloadRecordLine(): string {
  return tRaw('Downloads will carry Content Credentials that record: {declaration}.', { declaration: TUNE_DECLARATION });
}

/** Render's choices, worded for a track that is or is not rendered yet. */
export function renderChoices(rendered: boolean): MenuChoice<RenderChoice>[] {
  return [
    {
      id: 'play', icon: 'play',
      title: rendered ? t('Play') : t('Render and play'),
      note: rendered ? t('Plays the finished render from the selected bar.') : t('Renders every part at full quality, then plays the track.'),
    },
    { id: 'm4a', icon: 'download', title: t('Download M4A'), note: t('A smaller file that plays almost anywhere.') },
    { id: 'wav', icon: 'download', title: t('Download WAV'), note: t('Uncompressed, for editing and mastering.') },
  ];
}

export interface RenderButton {
  isOpen(): boolean;
  close(): void;
  /** Mark the button as holding a finished render, or not. */
  showRendered(on: boolean): void;
  /** Run a download with the button busy, then its tick, or the failure beside the button. */
  run(work: () => Promise<void>): Promise<string | null>;
  /** Back to rest at once (the view going away). */
  reset(): void;
}

/** Wire the button to its choices; `pick` gets the one chosen. */
export function wireRenderButton(button: HTMLButtonElement, pick: (choice: RenderChoice) => void): RenderButton {
  let rendered = false;
  const act = actionButton(button, { busy: t('Preparing…'), done: t('Downloaded'), failed: t('The file could not be made.'), trail: 'chevronDown' });
  const menu = wireChoiceMenu<RenderChoice>(button, {
    title: t('Render'),
    choices: () => renderChoices(rendered),
    pick,
    foot: downloadRecordLine,
    footAttr: 'data-cred-note',
  });
  return {
    isOpen: () => menu.isOpen(),
    close: () => menu.close(),
    showRendered(on) {
      rendered = on;
      button.classList.toggle('is-rendered', on);
      act.setRest(on ? t('Rendered') : t('Render'), on ? 'check' : null);
    },
    run: (work) => act.run(work),
    reset: () => act.reset(),
  };
}
