// SPDX-License-Identifier: MPL-2.0
/** Author-owned clicker and scrolling preferences, committed as one undo step. */
import {
  parsePresentInteractOpts, serialisePresentInteractOpts, parsePresentInteractDepth,
  PRESENT_INTERACT_DEFAULTS, type PresentInteractOptions,
} from '../../../../engine/src/present-interact.ts';
import { normaliseKfEase } from '../../../../engine/src/keyframes.ts';
import { parseWebEmbed } from '../../../../engine/src/web-embed.ts';
import { t } from '../i18n.ts';
import { escape as esc } from '../utils.ts';
import { icon } from '../lib/icons.ts';
import { fieldFocusToken } from '../lib/collab-field-focus.ts';
import { colorFieldHtml, resolveColorVar } from '../components/color-field.ts';
import { getWebPageDriver } from '../lib/web-page-driver.ts';
import type { Box } from './free-canvas-math.ts';
import type { ModelPort } from './design-ports.ts';

type Choice = readonly [string, string];
type Control = HTMLInputElement | HTMLSelectElement;
const disclosureStates = new WeakMap<HTMLElement, Map<string, boolean>>();
const active = (box: Box): boolean => box.interact !== '' && box.interact != null && Number.isFinite(Number(box.interact));

function select(key: keyof PresentInteractOptions, label: string, value: unknown, choices: readonly Choice[]): string {
  return `<label class="fc-row"><span>${esc(label)}</span><select class="field-select field-select--sm" data-web-interact="${key}">`
    + choices.map(([v, text]) => `<option value="${esc(v)}"${String(value) === v ? ' selected' : ''}>${esc(text)}</option>`).join('') + '</select></label>';
}
function input(key: string, label: string, value: unknown, attrs = ''): string {
  const cls = attrs.includes('type="range"') ? 'field-range' : 'field-input';
  return `<label class="fc-row fc-insp-text"><span>${esc(label)}</span><input class="${cls}" data-web-interact="${key}" value="${esc(String(value))}" ${attrs}></label>`;
}
function toggle(key: string, label: string, on: boolean): string {
  return `<label class="fc-row fc-row-toggle field-toggle"><span>${esc(label)}</span><input type="checkbox" class="field-check" data-web-interact="${key}"${on ? ' checked' : ''}></label>`;
}
const hint = (value: string): string => `<p class="fc-insp-hint">${esc(value)}</p>`;
const group = (title: string, body: string): string => `<details class="fc-web-interact-group"><summary>${esc(title)}</summary>${body}</details>`;

function stopRows(options: PresentInteractOptions): string {
  return '<ol class="fc-web-stops">' + options.stops.map((depth, index) => `<li>`
    + `<label><span class="visually-hidden">${esc(t('Stop {n}', { n: index + 1 }))}</span>`
    + `<input class="field-input" data-web-stop="${index}" value="${esc(String(depth))}" maxlength="128" spellcheck="false"></label>`
    + `<button type="button" class="btn btn--ghost btn--sm" data-web-stop-remove="${index}" title="${esc(t('Remove stop {n}', { n: index + 1 }))}" aria-label="${esc(t('Remove stop {n}', { n: index + 1 }))}">${icon('trash', { size: 16 })}</button></li>`).join('')
    + `</ol><div class="fc-web-interact-actions"><button type="button" class="btn btn--sm" data-web-add-stop>${t('Add stop')}</button>`
    + `<button type="button" class="btn btn--sm" data-web-depth="stop">${t('Add current depth')}</button></div>`;
}

function scrollRows(options: PresentInteractOptions, sameOrigin: boolean): string {
  return (!sameOrigin ? select('mode', t('For other sites'), options.mode, [
    ['none', t('Choose how to scroll')], ['places', t('Places on the page')], ['pan', t('Pan a taller page')],
  ]) : '')
    + (options.mode === 'places' && !sameOrigin ? hint(t('Places use page IDs such as #pricing, rather than pixels or percentages. A site that routes on the hash may change its view instead of scrolling.')) : '')
    + (options.mode === 'pan' && !sameOrigin
      ? input('pageLength', t('Page length (px)'), options.pageLength || 3200, 'type="number" min="1" max="1000000" step="1"')
        + hint(t('The page uses one tall window. Full-height sections stretch, sticky headers stay at the top, and the page scroll effects do not run.'))
        + input('preview', t('Preview depth'), 0, 'type="range" min="0" max="100" step="1"') : '')
    + input('start', t('Start at'), options.start, 'type="text" maxlength="128" spellcheck="false" placeholder="640, 50%, #pricing"')
    + `<button type="button" class="btn btn--sm" data-web-depth="start">${t('Use current depth')}</button>`
    + toggle('keep', t('Keep the last position'), options.keep)
    + hint(t('Keep the last position applies when the page is set to Keep running.'))
    + group(t('Scroll stops'), stopRows(options) + hint(t('Use pixels, a percentage of the scroll range, or a page ID. Up to 32 stops, in the order you want to visit them.')))
    + input('scrollMs', t('Scroll speed (ms)'), options.scrollMs, 'type="number" min="0" max="10000" step="50"')
    + toggle('walk', t('Clicker walks the scroll stops'), options.walk)
    + hint(t('Off: Next moves the deck. On: Next visits the remaining stops before moving the deck.'));
}

function autoRows(options: PresentInteractOptions): string {
  return select('auto', t('Scroll on its own'), options.auto, [
    ['off', t('Off')], ['open', t('When the slide opens')], ['focus', t('When focused')],
  ]) + (options.auto === 'off' ? '' : input('from', t('From'), options.from, 'type="text" maxlength="128" spellcheck="false"')
    + input('to', t('To'), options.to, 'type="text" maxlength="128" spellcheck="false"')
    + input('seconds', t('Over (seconds)'), options.seconds, 'type="number" min="1" max="600" step="1"')
    + select('ease', t('Easing'), options.ease, [['el', t('Linear')], ['ei', t('Ease in')], ['eo', t('Ease out')], ['eio', t('Ease in and out')]])
    + select('repeat', t('Repeat'), options.repeat, [['once', t('Once')], ['loop', t('Loop')], ['alternate', t('Back and forth')]])
    + input('pauseSeconds', t('Pause at each stop (seconds)'), options.pauseSeconds, 'type="number" min="0" max="600" step="0.5"')
    + hint(t('Up or Down takes over. Blackout, overview and Pause stop automatic scrolling. Reduced motion uses stop changes instead of continuous movement.')));
}

/** Empty interaction fields preserve the old Web page section and its controls. */
export function webInteractRows(box: Box, colourScope?: HTMLElement): string {
  const enabled = active(box);
  const parsed = parsePresentInteractOpts(box.interactOpts);
  const options = parsed ?? PRESENT_INTERACT_DEFAULTS;
  const sameOrigin = parseWebEmbed(String(box.web ?? ''), { appOrigin: location.origin })?.sameOrigin ?? false;
  const colour = options.highlightColor.startsWith('#') ? options.highlightColor
    : resolveColorVar(`var(--brand-${options.highlightColor.replaceAll('.', '-')}, var(--brand-primary, #4c8dff))`, colourScope);
  return `<div class="fc-web-interact">${toggle('enabled', t('Make interactive'), enabled)}`
    + (enabled ? hint(t('The deck keeps the clicker. Up and Down control this page while its highlight is active.'))
      + input('step', t('Focus on click'), box.interact, 'type="number" min="0" max="999" step="1"')
      + hint(t('0 means when the slide opens. The next click releases the page and continues the deck.'))
      + select('highlight', t('Highlight'), options.highlight, [['ring', t('Ring')], ['spotlight', t('Spotlight')], ['zoom', t('Zoom')], ['none', t('None')]])
      + (options.highlight !== 'none' ? `<div class="fc-row"><span>${t('Highlight colour')}</span>`
        + colorFieldHtml('fc-insp-interact-highlight', colour, { float: true, label: t('Highlight colour') })
        + '</div>' + `<button type="button" class="btn btn--sm" data-web-accent>${t('Use document accent')}</button>` : '')
      + select('keys', t('Up and Down'), options.keys, [['scroll', t('Scroll the page')], ['key', t('Act like the keyboard')], ['none', t('Nothing')]])
      + `<p class="fc-insp-hint" data-web-capability role="status">${t('Checking the page…')}</p>`
      + group(t('Scroll and depth'), scrollRows(options, sameOrigin))
      + group(t('Automatic scrolling'), autoRows(options))
      + group(t('Keyboard handover'), toggle('hand', t('Hand the keyboard to the page'), options.hand)
        + hint(sameOrigin ? t('Press Enter while highlighted to type into the page. Back to slides returns the keyboard to the deck.')
          : t('While the page has the keyboard, the clicker goes to the page. Click Back to slides to take it back.')))
      + (!parsed ? hint(t('These interaction settings could not be read. Choose settings here to replace them.')) : '') : '')
    + '<p class="fc-insp-hint fc-web-interact-error" data-web-interact-error role="alert" hidden></p></div>';
}

function markerFor(canvas: HTMLElement, id: string): HTMLElement | null {
  return [...canvas.querySelectorAll<HTMLElement>('[data-box-id]')].find(el => el.dataset.boxId === id)?.querySelector<HTMLElement>('.lolly-box-web') ?? null;
}

/** Duplicate focus steps and invalid depths never write a partial document change. */
export function wireWebInteract(root: HTMLElement, model: ModelPort, ids: readonly string[], canvas: HTMLElement): () => void {
  if (ids.length !== 1) return () => {};
  const id = ids[0]!;
  const idField = model.cfg.idField ?? 'id';
  let disposed = false;
  const current = (): Box | undefined => disposed ? undefined : model.getBoxes().find(box => String(box[idField]) === id && box.kind === 'web');
  const error = (message = '', control?: Control): void => {
    if (disposed) return;
    const target = root.querySelector<HTMLElement>('[data-web-interact-error]');
    if (target) { target.hidden = !message; target.textContent = message; }
    control?.setCustomValidity(message);
    if (message) control?.reportValidity();
  };
  const commit = (patch: Partial<Box>): void => {
    if (!current()) return;
    model.commit(model.getBoxes().map(box => String(box[idField]) === id ? { ...box, ...patch } : box));
  };
  const options = (): PresentInteractOptions => parsePresentInteractOpts(current()?.interactOpts) ?? { ...PRESENT_INTERACT_DEFAULTS, stops: [...PRESENT_INTERACT_DEFAULTS.stops] };
  const save = (next: PresentInteractOptions, control?: Control): void => {
    try { const wire = serialisePresentInteractOpts(next); if (!parsePresentInteractOpts(wire)) throw new Error('invalid'); error('', control); commit({ interactOpts: wire }); }
    catch { error(t('Use valid interaction settings, with up to 32 stops.'), control); }
  };
  const usedSteps = (box: Box): Set<number> => new Set(model.getBoxes().filter(other => String(other[idField]) !== id && other.frame === box.frame && other.kind === 'web' && active(other)).map(other => Number(other.interact)));
  const driver = () => { const marker = markerFor(canvas, id); return marker ? getWebPageDriver(marker) : null; };
  const outside = (): boolean => !parseWebEmbed(String(current()?.web ?? ''), { appOrigin: location.origin })?.sameOrigin && driver()?.capabilities.backend !== 'receiver';
  const validDepth = (depth: ReturnType<typeof parsePresentInteractDepth>, control?: Control): boolean => {
    if (!current()) return false;
    if (depth == null) { error(t('Use pixels, a percentage such as 50%, or a page ID such as #pricing.'), control); return false; }
    const mode = options().mode;
    if (outside() && ((mode === 'places' && !(typeof depth === 'string' && depth.startsWith('#'))) || (mode === 'pan' && typeof depth === 'string' && depth.startsWith('#')))) {
      error(mode === 'places' ? t('Places need a page ID such as #pricing.') : t('Pan needs pixels or a percentage, such as 640 or 50%.'), control); return false;
    }
    return true;
  };

  const folds = disclosureStates.get(root) ?? new Map<string, boolean>();
  disclosureStates.set(root, folds);
  if (model.collection) {
    const token = fieldFocusToken(model.collection, id, 'interactOpts');
    for (const control of root.querySelectorAll<HTMLElement>('[data-color-field], [data-web-accent], [data-web-depth], [data-web-add-stop], [data-web-stop-remove]')) control.dataset.collabFocus = token;
  }
  for (const detail of root.querySelectorAll<HTMLDetailsElement>('.fc-web-interact-group')) {
    const name = detail.querySelector('summary')?.textContent ?? '';
    detail.open = folds.get(name) ?? false;
    detail.addEventListener('toggle', () => { if (detail.isConnected) folds.set(name, detail.open); });
  }

  for (const control of root.querySelectorAll<Control>('[data-web-interact]')) {
    const key = control.dataset.webInteract!;
    if (model.collection) control.dataset.collabFocus = fieldFocusToken(model.collection, id, key === 'enabled' || key === 'step' ? 'interact' : 'interactOpts');
    control.addEventListener('change', () => {
      const box = current(); if (!box) return;
      if (key === 'enabled') {
        if (!(control as HTMLInputElement).checked) { commit({ interact: '' }); return; }
        let step = Math.max(1, Math.round(Number(box.build) || 0) + 1);
        if (step > 999) { error(t('Choose a focus step from 0 to 999 at or after the page appears.'), control); (control as HTMLInputElement).checked = false; return; }
        const used = usedSteps(box); while (used.has(step) && step < 999) step++;
        if (used.has(step)) { error(t('This slide has no free focus step.'), control); return; }
        commit({ interact: step, interactOpts: serialisePresentInteractOpts(options()) }); return;
      }
      if (key === 'step') {
        const step = Number(control.value);
        if (control.value.trim() === '' || !Number.isInteger(step) || step < 0 || step > 999) { error(t('Choose a whole focus step from 0 to 999.'), control); return; }
        if (usedSteps(box).has(step)) { error(t('Another page on this slide already uses this focus step.'), control); return; }
        if (step < Number(box.build || 0)) { error(t('Choose the click where the page appears, or a later click.'), control); return; }
        error('', control); commit({ interact: step }); return;
      }
      if (key === 'preview') {
        const page = driver(), depth = page?.depth();
        if (depth) page?.scrollTo(depth.max * Number(control.value) / 100);
        return;
      }
      const next = options();
      const value = control instanceof HTMLInputElement && control.type === 'checkbox' ? control.checked : control.value;
      if (key === 'start' || key === 'from' || key === 'to') {
        const depth = parsePresentInteractDepth(value);
        if (!validDepth(depth, control)) return;
        next[key] = depth!;
      } else if (['pageLength', 'seconds', 'pauseSeconds', 'scrollMs'].includes(key)) {
        if (!Number.isFinite(Number(value)) || String(value).trim() === '') { error(t('Enter a finite number.'), control); return; }
        if (control instanceof HTMLInputElement && (control.validity.rangeUnderflow || control.validity.rangeOverflow)) { error(t('Choose a number within the displayed limits.'), control); return; }
        Object.assign(next, { [key]: Number(value) });
      } else if (key === 'ease') {
        const ease = normaliseKfEase(value); if (!ease) return; next.ease = ease;
      } else Object.assign(next, { [key]: value });
      if (key === 'mode' && value === 'pan' && !next.pageLength) next.pageLength = 3200;
      save(next, control);
    });
    if (key === 'preview') control.addEventListener('input', () => {
      const page = driver(), depth = page?.depth();
      if (depth) page?.scrollTo(depth.max * Number(control.value) / 100);
    });
  }
  for (const control of root.querySelectorAll<HTMLInputElement>('[data-web-stop]')) {
    if (model.collection) control.dataset.collabFocus = fieldFocusToken(model.collection, id, 'interactOpts');
    control.addEventListener('change', () => {
      const depth = parsePresentInteractDepth(control.value);
      if (!validDepth(depth, control)) return;
      const next = options(); next.stops = [...next.stops]; next.stops[Number(control.dataset.webStop)] = depth!; save(next, control);
    });
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-web-stop-remove]')) button.addEventListener('click', () => {
    const next = options(); next.stops = next.stops.filter((_, i) => i !== Number(button.dataset.webStopRemove)); save(next);
  });
  root.querySelector('[data-web-add-stop]')?.addEventListener('click', () => {
    if (!current()) return;
    const next = options(); if (next.stops.length >= 32) { error(t('A page can have up to 32 scroll stops.')); return; }
    if (outside() && next.mode === 'places') {
      const list = root.querySelector('.fc-web-stops'); if (!list || list.querySelector('[data-web-pending-stop]')) return;
      const item = document.createElement('li');
      const input = document.createElement('input');
      Object.assign(input, { className: 'field-input', placeholder: '#pricing', maxLength: 128, spellcheck: false });
      input.dataset.webPendingStop = ''; input.setAttribute('aria-label', t('New scroll stop'));
      item.append(input); list.append(item);
      if (model.collection) input.dataset.collabFocus = fieldFocusToken(model.collection, id, 'interactOpts');
      input.addEventListener('change', () => { const depth = parsePresentInteractDepth(input.value); if (!validDepth(depth, input)) return;
        const latest = options(); if (latest.stops.length >= 32) { error(t('A page can have up to 32 scroll stops.'), input); return; }
        latest.stops = [...latest.stops, depth!]; save(latest, input);
      }); input.focus(); return;
    }
    next.stops = [...next.stops, 0]; save(next);
  });
  root.querySelector('[data-web-accent]')?.addEventListener('click', () => { const next = options(); next.highlightColor = 'accent'; save(next); });
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-web-depth]')) button.addEventListener('click', () => {
    const depth = driver()?.depth(); if (!depth) { error(t('Load a page Lolly can scroll, or choose Pan, to use its current depth.')); return; }
    const next = options(), y = Math.round(depth.y);
    if (button.dataset.webDepth === 'start') next.start = y;
    else { if (next.stops.length >= 32) { error(t('A page can have up to 32 scroll stops.')); return; } next.stops = [...next.stops, y]; }
    save(next);
  });
  refreshWebInteractCapability(root, canvas, id);
  const refresh = (): void => refreshWebInteractCapability(root, canvas, id);
  canvas.addEventListener('lolly:web-driver-change', refresh);
  return () => { disposed = true; canvas.removeEventListener('lolly:web-driver-change', refresh); };
}

export function commitWebInteractColour(model: ModelPort, ids: readonly string[], colour: unknown): void {
  if (ids.length !== 1) return;
  const idField = model.cfg.idField ?? 'id';
  const box = model.getBoxes().find(row => String(row[idField]) === ids[0]);
  if (!box) return;
  const value = typeof colour === 'object' && colour !== null && 'value' in colour ? colour.value : colour;
  if (typeof value !== 'string' || !/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) return;
  const next = parsePresentInteractOpts(box.interactOpts) ?? { ...PRESENT_INTERACT_DEFAULTS, stops: [] };
  next.highlightColor = value;
  const wire = serialisePresentInteractOpts(next);
  model.commit(model.getBoxes().map(row => String(row[idField]) === ids[0] ? { ...row, interactOpts: wire } : row));
}

export function refreshWebInteractCapability(root: HTMLElement, canvas: HTMLElement, id: string): void {
  const marker = markerFor(canvas, id);
  const page = marker ? getWebPageDriver(marker) : null;
  const target = root.querySelector<HTMLElement>('[data-web-capability]');
  if (!target) return;
  target.textContent = !marker || !page ? t('Load this page to check what the clicker can control.')
    : page.capabilities.checking ? t('Checking the page…')
      : page.capabilities.backend === 'same-origin' ? t('Lolly can scroll this page.')
        : page.capabilities.backend === 'receiver' ? t('This page listens to the clicker.')
          : marker?.dataset.interactOpts && parsePresentInteractOpts(marker.dataset.interactOpts)?.mode === 'places' && !page.capabilities.scroll
            ? t('This browser cannot move between places on this page. Choose Pan a taller page instead.')
            : t('This site cannot receive keys. Choose Places or Pan to move through the page.');
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-web-depth]')) button.disabled = !page?.capabilities.depth;
}
