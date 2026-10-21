// SPDX-License-Identifier: MPL-2.0
/**
 * The design system's choices for one document (plans/319 A4): colourway, mode
 * and any other theme group, drawn in the tool sidebar's Design system section.
 *
 * Chrome, not an input. The choices belong to the token document, not to the
 * tool's manifest, so every tool gets the control and none declares it; the
 * state lives in the one `DocumentThemeController` the tool view creates
 * (lib/document-theme.ts), which the Design inspector draws from as well. This
 * file only draws a port and hands presses back to it, so the sidebar and the
 * inspector can never show two different choices.
 *
 * One control per kind of group, the smallest that says what it is:
 *  - a colourway is a row of swatch dots, each the lead it gives (with its
 *    partner as a corner) in the look in force, and the chosen name beside them;
 *  - the mode (light and dark) is a segmented control;
 *  - any other group is a select, since its options are words the design system
 *    chose and there may be many.
 *
 * Every row is reachable by keyboard and named for a screen reader: the dots and
 * the segments are ARIA radio groups with one tab stop and arrow keys, each dot
 * named by its colourway, and the select is a native select with a label. Each
 * control is named by its group label alone; the section tip on the first row
 * describes that row's control and stays out of its name.
 * Ids the design system wrote never reach the markup; rows and options are
 * addressed by index, and labels are escaped.
 */
import './theme-choices.css';
import type { DocumentThemeGroup, DocumentThemePort } from '../lib/document-theme.ts';
import { helpTip, linkHelpDescriptions, unwireHelpTips, wireHelpTips } from './help-tip.ts';
import { t } from '../i18n.ts';
import { escape as escapeText } from '../utils.ts';

export interface ThemeChoices {
  /** Draw the port's groups again (the controller calls this on every change). */
  update(): void;
  destroy(): void;
}

export interface ThemeChoicesOpts {
  /** Called after each draw with whether there is anything to show, so the section
   *  around the control can hide itself when the design system offers no choice. */
  onVisible?(visible: boolean): void;
}

/** A segmented control holds this many options at most; more draw as a select. */
const MAX_SEGMENTS = 4;
const HEX = /^#[0-9a-f]{6}$/i;

type RowKind = 'swatches' | 'segments' | 'select';

/** Which control a group draws as. Exported for the tests. */
export function rowKind(group: DocumentThemeGroup): RowKind {
  if (group.kind === 'colourway' && group.options.every((o) => o.swatch && HEX.test(o.swatch.lead))) return 'swatches';
  if ((group.kind === 'mode' || group.kind === 'colourway') && group.options.length <= MAX_SEGMENTS) return 'segments';
  return 'select';
}

let seq = 0;

export function mountThemeChoices(el: HTMLElement, port: DocumentThemePort, opts: ThemeChoicesOpts = {}): ThemeChoices {
  const id = `theme-choices-${++seq}`;
  let destroyed = false;
  let drawn: DocumentThemeGroup[] = [];
  el.classList.add('theme-choices');

  function radio(gi: number, oi: number, on: boolean, cls: string, inner: string, name: string, tip: boolean): string {
    return `<button type="button" role="radio" class="${cls}${on ? ' is-on' : ''}" data-theme-row="${gi}" data-theme-option="${oi}"`
      + ` aria-checked="${on ? 'true' : 'false'}" tabindex="${on ? '0' : '-1'}"`
      + (tip ? ` aria-label="${escapeText(name)}" data-tip="${escapeText(name)}"` : '')
      + `>${inner}</button>`;
  }

  /** Presses the controller has not confirmed yet, by group id: the option the row
   *  shows meanwhile, and which press that was. */
  const pending = new Map<string, { option: string; press: number }>();
  let presses = 0;

  /** The option a row shows: the latest press while its switch is on the way, else the choice in force. */
  function shownOption(group: DocumentThemeGroup): string {
    const want = pending.get(group.id)?.option;
    return want !== undefined && group.options.some((o) => o.id === want) ? want : group.active;
  }

  function rowHtml(group: DocumentThemeGroup, gi: number): string {
    const labelId = `${id}-${gi}`;
    const kind = rowKind(group);
    const shown = shownOption(group);
    const activeIndex = Math.max(0, group.options.findIndex((o) => o.id === shown));
    // One tip for the section, on its first row: what the choices change. The control
    // is named by the label text alone and described by the tip, so a screen reader
    // reads "Colourway", then the tip, never the tip button's own name.
    const tip = gi === 0 ? helpTip(t('Colours linked to the design system follow this choice.')) : null;
    const label = `<span class="field-label theme-choice-label"><span id="${labelId}">${escapeText(group.label)}</span>${tip ? tip.button : ''}</span>`;
    const names = `aria-labelledby="${labelId}"${tip ? ` aria-describedby="${tip.id}"` : ''}`;
    let control: string;
    if (kind === 'swatches') {
      const dots = group.options.map((o, oi) => radio(gi, oi, oi === activeIndex, 'theme-swatch',
        '<span class="theme-swatch-dot" aria-hidden="true"></span>', o.label, true)).join('');
      control = `<div class="theme-swatches" role="radiogroup" ${names}>${dots}`
        + `<span class="theme-swatch-name" aria-hidden="true">${escapeText(group.options[activeIndex]?.label ?? '')}</span></div>`;
    } else if (kind === 'segments') {
      const segments = group.options.map((o, oi) => radio(gi, oi, oi === activeIndex, 'badge-select-opt',
        `<span class="badge-select-label">${escapeText(o.label)}</span>`, o.label, false)).join('');
      control = `<div class="badge-select badge-select--segmented" role="radiogroup" ${names}>${segments}</div>`;
    } else {
      const options = group.options.map((o, oi) => `<option value="${oi}"${oi === activeIndex ? ' selected' : ''}>${escapeText(o.label)}</option>`).join('');
      control = `<select class="field-select" data-theme-row="${gi}" ${names}>${options}</select>`;
    }
    return `<div class="field-row theme-choice${tip ? ' help-tip-host' : ''}" data-theme-kind="${kind}">${label}${control}${tip ? tip.pop : ''}</div>`;
  }

  /** The colours go on through the CSSOM, never as markup: they are design data. */
  function paintSwatches(): void {
    el.querySelectorAll<HTMLElement>('.theme-swatch').forEach((button) => {
      const option = drawn[Number(button.dataset.themeRow)]?.options[Number(button.dataset.themeOption)];
      const swatch = option?.swatch;
      if (!swatch || !HEX.test(swatch.lead)) return;
      button.style.setProperty('--theme-swatch-lead', swatch.lead);
      button.style.setProperty('--theme-swatch-partner', swatch.partner && HEX.test(swatch.partner) ? swatch.partner : swatch.lead);
    });
  }

  function draw(): void {
    if (destroyed) return;
    // Focus survives a redraw on the same row, on the option now chosen.
    const focused = document.activeElement instanceof HTMLElement && el.contains(document.activeElement) ? document.activeElement : null;
    const focusRow = focused?.dataset.themeRow;
    drawn = port.groups();
    el.innerHTML = drawn.map(rowHtml).join('');
    paintSwatches();
    if (focusRow !== undefined) {
      const back = el.querySelector<HTMLElement>(`[data-theme-row="${focusRow}"][aria-checked="true"], select[data-theme-row="${focusRow}"]`);
      back?.focus();
    }
    linkHelpDescriptions(el);
    opts.onVisible?.(drawn.length > 0);
  }

  function choose(gi: number, oi: number): void {
    const group = drawn[gi];
    const option = group?.options[oi];
    // Compared with what the row shows, not with the choice in force: a second press
    // made before the first switch has finished (straight back, or two quick arrow keys) is
    // the one that counts. The controller applies presses in the order they were made.
    if (!group || !option || option.id === shownOption(group)) return;
    const press = ++presses;
    pending.set(group.id, { option: option.id, press });
    // The press shows at once and stays shown while earlier switches land. The last
    // press's answer settles the row: on the choice now in force, or back on the one
    // still in force when the switch fails.
    draw();
    const settle = (): void => {
      if (pending.get(group.id)?.press !== press) return;
      pending.delete(group.id);
      draw();
    };
    void port.choose(group.id, option.id).then(settle, (error: unknown) => {
      console.warn('[theme] the choice could not be applied:', error);
      settle();
    });
  }

  function onClick(event: Event): void {
    const button = (event.target as Element | null)?.closest<HTMLElement>('[role="radio"][data-theme-row]');
    if (!button || !el.contains(button)) return;
    choose(Number(button.dataset.themeRow), Number(button.dataset.themeOption));
  }

  function onChange(event: Event): void {
    const select = event.target as HTMLSelectElement | null;
    if (!select?.matches?.('select[data-theme-row]')) return;
    choose(Number(select.dataset.themeRow), Number(select.value));
  }

  /** The ARIA radio group keys: arrows move and choose, Home and End jump. */
  function onKeyDown(event: KeyboardEvent): void {
    const button = (event.target as Element | null)?.closest<HTMLElement>('[role="radio"][data-theme-row]');
    if (!button) return;
    const gi = Number(button.dataset.themeRow);
    const count = drawn[gi]?.options.length ?? 0;
    if (!count) return;
    const index = Number(button.dataset.themeOption);
    let next: number;
    switch (event.key) {
      case 'ArrowRight': case 'ArrowDown': next = (index + 1) % count; break;
      case 'ArrowLeft': case 'ArrowUp': next = (index - 1 + count) % count; break;
      case 'Home': next = 0; break;
      case 'End': next = count - 1; break;
      default: return;
    }
    event.preventDefault();
    choose(gi, next);
    el.querySelector<HTMLElement>(`[role="radio"][data-theme-row="${gi}"][data-theme-option="${next}"]`)?.focus();
  }

  el.addEventListener('click', onClick);
  el.addEventListener('change', onChange);
  el.addEventListener('keydown', onKeyDown);
  // The tip's button, Escape and outside click. The sidebar wires tips inside
  // #tool-inputs only, and this control sits outside that container.
  wireHelpTips(el);
  const off = port.subscribe?.(draw);
  draw();

  return {
    update: draw,
    destroy() {
      destroyed = true;
      off?.();
      el.removeEventListener('click', onClick);
      el.removeEventListener('change', onChange);
      el.removeEventListener('keydown', onKeyDown);
      unwireHelpTips(el);
      el.replaceChildren();
    },
  };
}
