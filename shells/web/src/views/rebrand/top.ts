// SPDX-License-Identifier: MPL-2.0
/**
 * rebrand: top bar (plan 274 section 2.1 step 1, section 4 "Layout"; plan 275 close-out
 * section 3.1).
 *
 * Owns `rb.els.top` except `rb.els.modeSlot`, which keep.ts fills, and the deck theme
 * slot, which theme.ts fills. Contents: the back pill and home affordance the other
 * views use, the project name (the source file name until renamed) and the target
 * design system by name ("Design system: SUSE (neutral master)" when the neutral master
 * stands in); Undo and Redo as icon buttons whose name and tooltip carry the step ("Undo
 * remove 18 objects"); the save state from `state.save` as words and never a glyph:
 * nothing on screen while it is fine (a screen reader still hears "Saved on this
 * device"), muted words for "Saving", "Not saved: storage is full" with Download and
 * "Changed in another tab" with Reload; and an overflow menu with Download .lolly, Close
 * project, Delete project (confirmed through the standard confirm dialog), Keyboard
 * shortcuts and About Renovate and Keep. Once a plan is open the menu also offers Open a
 * newer version (a file pick read into the same lineage), Choose a preset (the standard
 * choice dialog over the presets on offer, applied as one undoable step, offered only
 * when a preset exists) and Save as my preset (the standard prompt for a name, written
 * to the personal layer); both live in the intake module, which offers the same choice
 * for the next read, and are reached through `rb.intake`. Their results show in the
 * footer's outcome line (`rb.foot.say`).
 *
 * The bar is built once, in `wireTop`, around the mode slot that is already in the
 * header, so keep.ts can fill that slot without either module touching the other's
 * nodes. A render only sets text, `hidden`, `disabled` and the names.
 */
import { backPillHtml, mountBackPill } from '../../components/back-pill.ts';
import { mountBodyPopover, type BodyPopoverHandle } from '../../components/body-popover.ts';
import { confirmDialog, noticeDialog } from '../../components/confirm-dialog.ts';
import { homeFabEl } from '../../components/home-fab.ts';
import { tRaw } from '../../i18n.ts';
import { icon, type IconName } from '../../lib/icons.ts';
import type { RebrandHistoryLabelV1, RebrandSaveStateV1 } from '../../lib/rebrand/controller-api.ts';
import { bindOp, type RbCtx } from './context.ts';

// ─── view-only state ─────────────────────────────────────────────────────────

interface TopEls {
  name: HTMLElement;
  system: HTMLElement;
  /** The Deck theme control's slot, which theme.ts fills. */
  theme: HTMLElement;
  save: HTMLElement;
  saveText: HTMLElement;
  saveAction: HTMLButtonElement;
  /** Holds Undo and Redo, which show once a plan exists (the same reason as `menuSlot`). */
  history: HTMLElement;
  undo: HTMLButtonElement;
  redo: HTMLButtonElement;
  /** Holds the project actions button, shown while a project is open. */
  menuSlot: HTMLElement;
  more: HTMLButtonElement;
}

interface TopLocal {
  els: TopEls | null;
  /** The file input Open a newer version picks through, in the bar only while a plan can take one. */
  versionInput: HTMLInputElement | null;
  menu: BodyPopoverHandle | null;
  /** The save state the last render drew, so a change into one that needs action is said. */
  saveKind: RebrandSaveStateV1['kind'] | null;
}

const LOCAL = new WeakMap<RbCtx, TopLocal>();

function localOf(rb: RbCtx): TopLocal {
  let local = LOCAL.get(rb);
  if (!local) {
    local = { els: null, versionInput: null, menu: null, saveKind: null };
    LOCAL.set(rb, local);
  }
  return local;
}

// ─── small DOM helpers (this module builds nodes, never markup) ─────────────

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** A registered glyph as a node: the icon registry's markup read as SVG, so no HTML sink is involved. */
function glyphNode(name: IconName): Node | null {
  const markup = icon(name);
  if (!markup || typeof DOMParser === 'undefined') return null;
  const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
  if (parsed?.localName !== 'svg') return null;
  return document.importNode(parsed, true);
}

/** The shared back pill, read from its component's markup into a node. */
function backPillNode(): HTMLElement | null {
  if (typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(backPillHtml({ class: 'rb-back' }), 'text/html');
  const pill = doc.body.firstElementChild;
  return pill ? (document.importNode(pill, true) as HTMLElement) : null;
}

function button(className: string, label: string, glyphName?: IconName): { el: HTMLButtonElement; label: HTMLElement } {
  const el = node('button', className);
  el.type = 'button';
  const glyph = glyphName ? glyphNode(glyphName) : null;
  if (glyph) el.append(glyph);
  const text = node('span', 'rb-btn-label', label);
  el.append(text);
  return { el, label: text };
}

/**
 * An icon-only button of the panel primitive (`lp-iconbtn`). Its name is the
 * `aria-label` and the same words are its tooltip, so a pointer user reads what a
 * screen reader hears.
 */
function iconButton(className: string, label: string, glyphName: IconName): HTMLButtonElement {
  const el = node('button', `lp-iconbtn ${className}`);
  el.type = 'button';
  const glyph = glyphNode(glyphName);
  if (glyph) el.append(glyph);
  el.setAttribute('aria-label', label);
  el.title = label;
  return el;
}

// ─── copy ────────────────────────────────────────────────────────────────────

/**
 * The history kinds this bar has words for: the controller's own, and the ones plan 275
 * close-out CP11 appends (a deck theme, a slide's background, an arrangement, Auto-match,
 * a text correction and a slide reset). Widening here lets the words ship before the
 * controller writes those kinds.
 */
type StepKind = RebrandHistoryLabelV1['kind'] | 'theme' | 'ground' | 'arrangement' | 'auto-match' | 'text' | 'reset';

/** One history step as this bar reads it: the controller's label, over the wider list of kinds. */
export type RbStepLabel = Omit<RebrandHistoryLabelV1, 'kind'> & { kind: StepKind };

/** What one undo or redo step did, as the words after "Undo" or "Redo". */
function stepWords(step: RbStepLabel): string {
  const n = step.count;
  switch (step.kind) {
    case 'decide':
      switch (step.action) {
        case 'keep':
          return n === 1 ? tRaw('keep 1 object') : tRaw('keep {n} objects', { n });
        case 'replace':
          return n === 1 ? tRaw('replace 1 object') : tRaw('replace {n} objects', { n });
        case 'remove':
          return n === 1 ? tRaw('remove 1 object') : tRaw('remove {n} objects', { n });
        default:
          return n === 1 ? tRaw('decision on 1 object') : tRaw('decision on {n} objects', { n });
      }
    case 'accept':
      return n === 1 ? tRaw('accept 1 suggestion') : tRaw('accept {n} suggestions', { n });
    case 'include':
      return n === 1 ? tRaw('include 1 slide') : tRaw('include {n} slides', { n });
    case 'exclude':
      return n === 1 ? tRaw('leave out 1 slide') : tRaw('leave out {n} slides', { n });
    case 'move':
      return n > 1 ? tRaw('move {n} slides', { n }) : tRaw('move slide');
    case 'layout':
      return n === 1 ? tRaw('layout change on 1 slide') : tRaw('layout change on {n} slides', { n });
    case 'colour':
      return n === 1 ? tRaw('colour change') : tRaw('{n} colour changes', { n });
    case 'font':
      return n === 1 ? tRaw('font change') : tRaw('{n} font changes', { n });
    case 'shuffle':
      return tRaw('shuffle colours');
    case 'preset':
      return tRaw('apply a preset');
    case 'theme':
      return tRaw('deck theme change');
    case 'ground':
      return n === 1 ? tRaw('background change on 1 slide') : tRaw('background change on {n} slides', { n });
    case 'arrangement':
      return n === 1 ? tRaw('arrangement change on 1 slide') : tRaw('arrangement change on {n} slides', { n });
    case 'auto-match':
      return n === 1 ? tRaw('match 1 slide to its layout') : tRaw('match {n} slides to their layouts', { n });
    case 'text':
      return n === 1 ? tRaw('text correction') : tRaw('{n} text corrections', { n });
    case 'reset':
      return n === 1 ? tRaw('reset 1 slide') : tRaw('reset {n} slides', { n });
    default:
      // A kind added after this list: the step is still undoable, only unnamed.
      return tRaw('last change');
  }
}

/** "Undo remove 18 objects" for the button's name and tooltip, or plain "Undo" when there is nothing to name. */
export function undoLabel(step: RbStepLabel | undefined): string {
  return step ? tRaw('Undo {what}', { what: stepWords(step) }) : tRaw('Undo');
}

export function redoLabel(step: RbStepLabel | undefined): string {
  return step ? tRaw('Redo {what}', { what: stepWords(step) }) : tRaw('Redo');
}

/**
 * What a finished undo or redo is announced with: "Undone: remove 18 objects." The step
 * words are a verb phrase ("remove 18 objects") or a noun ("colour change"), and this
 * frame reads well with either. With `form` 'button' it is instead the name a button
 * that takes the step carries ("Undo remove 18 objects"), as the footer's inline Undo.
 */
export function stepDoneText(
  rb: RbCtx,
  direction: 'undo' | 'redo',
  step: RbStepLabel | undefined,
  form: 'said' | 'button' = 'said',
): string {
  void rb;
  if (form === 'button') return direction === 'undo' ? undoLabel(step) : redoLabel(step);
  if (!step) return direction === 'undo' ? tRaw('Undone.') : tRaw('Redone.');
  return direction === 'undo'
    ? tRaw('Undone: {what}.', { what: stepWords(step) })
    : tRaw('Redone: {what}.', { what: stepWords(step) });
}

/**
 * The save state in words, and the one action it offers. `fine` is a state that asks
 * nothing of the person: its words are for a screen reader only, since a sentence that
 * confirms a state that is fine is noise on screen.
 */
export function saveCopy(save: RebrandSaveStateV1): { text: string; fine?: boolean; action?: 'download' | 'reload' } {
  switch (save.kind) {
    case 'none':
      return { text: '' };
    case 'saving':
      return { text: tRaw('Saving') };
    case 'saved':
      return { text: tRaw('Saved on this device'), fine: true };
    case 'held':
      return { text: tRaw('Not saved: storage is full'), action: 'download' };
    case 'stale':
      return { text: tRaw('Changed in another tab'), action: 'reload' };
  }
}

/** The design system line under the project name. */
export function systemLine(rb: RbCtx): string {
  const system = rb.state.designSystem;
  if (!system) return '';
  return system.neutralMaster
    ? tRaw('Design system: {name} (neutral master)', { name: system.name })
    : tRaw('Design system: {name}', { name: system.name });
}

// ─── work ────────────────────────────────────────────────────────────────────

/** Download the project as a `.lolly`, whatever stage it reached. */
export async function downloadProject(rb: RbCtx): Promise<void> {
  try {
    const file = await rb.controller.downloadProject();
    if (!file) return;
    await rb.host.export.download(file.blob, file.filename);
    rb.foot.say(tRaw('Downloaded {name}.', { name: file.filename }));
  } catch {
    rb.foot.say(tRaw('The project file could not be made.'));
  }
}

/** Drop `?project=` from the address, so a reload does not reopen a project that was closed. */
function forgetProjectParam(): void {
  if (typeof location === 'undefined' || !/[?&]project=/.test(location.hash)) return;
  history.replaceState(history.state, '', '#/rebrand');
}

export function closeProject(rb: RbCtx): void {
  rb.controller.close();
  forgetProjectParam();
}

export async function deleteProject(rb: RbCtx): Promise<void> {
  const project = rb.state.project;
  if (!project) return;
  const ok = await confirmDialog({
    title: tRaw('Delete {name}?', { name: project.name }),
    message: tRaw('The project and its decisions are deleted from this device. The original file is not changed.'),
    confirmLabel: tRaw('Delete'),
  });
  if (!ok) return;
  await rb.controller.remove(project.id);
  if (rb.controller.getState().project?.id === project.id) rb.controller.close();
  forgetProjectParam();
  rb.announce(tRaw('Deleted {name}.', { name: project.name }));
}

/** What the two modes do, in the intake's words for each. */
export function aboutModes(): Promise<void> {
  return noticeDialog({
    title: tRaw('About Renovate and Keep'),
    message: [
      tRaw('Renovate the layout: Rebuilds each slide on the slide master.'),
      tRaw('Keep the design: Swaps in the theme, colours and fonts.'),
    ],
    okLabel: tRaw('Got it'),
  });
}

/** Pick a newer version of the open deck. */
export function pickNewerVersion(rb: RbCtx): void {
  if (!rb.state.project || !rb.controller.openNewerVersion) return;
  localOf(rb).versionInput?.click();
}

/**
 * The file input Open a newer version picks through, never shown. It is in the bar only
 * while a plan is open to take a newer version, so on the intake the one file field of
 * the view is the drop area's.
 */
function makeVersionInput(rb: RbCtx): HTMLInputElement {
  const input = node('input', 'rb-version-input');
  input.type = 'file';
  input.accept = '.pptx,.pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf';
  input.hidden = true;
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.value = '';
    // A pick that arrives after the project closed has nothing to be a version of.
    if (!file || !rb.state.project || !rb.controller.openNewerVersion) return;
    rb.foot.say(tRaw('Reading {name} as a newer version.', { name: file.name }));
    void rb.controller.openNewerVersion(file);
  });
  return input;
}

/** The overflow menu: one menu item per project action. Arrow keys move between them. */
function openMenu(rb: RbCtx, anchor: HTMLButtonElement): void {
  const local = localOf(rb);
  local.menu ??= mountBodyPopover(anchor, (el, popover) => {
    // Delete asks first, and a dialog never opens over a deck that is still being read.
    const reading = rb.state.phase === 'reading' || rb.state.phase === 'analysing';
    type Item = [string, IconName, () => void, string?];
    // On a narrow screen the mode control and the report link leave the bars for this
    // menu, so the top bar is one row and the footer keeps its primary in reach.
    const narrowItems: Item[] = [];
    if (rb.narrow) {
      const other = rb.state.mode === 'keep-design' ? 'renovate' : 'keep-design';
      narrowItems.push([other === 'renovate' ? tRaw('Renovate the layout') : tRaw('Keep the design'), other === 'renovate' ? 'grid' : 'palette', () => rb.keep.chooseMode(other)]);
      if (rb.state.plan && rb.state.mode === 'renovate') narrowItems.push([tRaw('Open the report'), 'checklist', () => rb.report.open()]);
    }
    // The plan actions: only on a plan the person can work on.
    const planItems: Item[] = [];
    if (rb.state.plan && rb.state.mode === 'renovate' && rb.state.phase === 'review') {
      if (rb.controller.openNewerVersion) planItems.push([tRaw('Open a newer version'), 'upload', () => pickNewerVersion(rb)]);
      // Offered only when there is a preset to choose; an empty choice would do nothing.
      if (rb.controller.applyPreset && rb.intake.hasPresets()) planItems.push([tRaw('Choose a preset'), 'sliders', () => void rb.intake.choosePreset('apply')]);
      if (rb.controller.savePreset) planItems.push([tRaw('Save as my preset'), 'star', () => void rb.intake.savePreset()]);
    }
    const helpItems: Item[] = [];
    // The same sheet `?` and the slide menu open (strip.ts), once there are slides to move through.
    if (rb.state.plan) helpItems.push([tRaw('Keyboard shortcuts'), 'keyboard', () => rb.strip.shortcuts()]);
    helpItems.push([tRaw('About Renovate and Keep'), 'info', () => void aboutModes()]);
    const items: Item[] = [
      ...narrowItems,
      ...planItems,
      ...helpItems,
      [tRaw('Download .lolly'), 'download', () => void downloadProject(rb)],
      [tRaw('Close project'), 'close', () => closeProject(rb)],
      ...(reading ? [] : [[tRaw('Delete project'), 'trash', () => void deleteProject(rb), 'folder-menu-item--danger'] as Item]),
    ];
    const buttons = items.map(([label, glyphName, act, extra]) => {
      const { el: item } = button(`folder-menu-item${extra ? ` ${extra}` : ''}`, label, glyphName);
      item.setAttribute('role', 'menuitem');
      item.tabIndex = -1;
      item.addEventListener('click', () => {
        popover.close();
        act();
      });
      return item;
    });
    el.replaceChildren(...buttons);
    el.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = (at + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length;
      buttons[next]?.focus();
    });
    return buttons[0] ?? null;
  }, { className: 'folder-menu rb-menu', role: 'menu', ariaLabel: tRaw('Project actions') });
  if (local.menu.isOpen()) local.menu.close();
  else local.menu.open();
}

// ─── wiring and drawing ──────────────────────────────────────────────────────

export function wireTop(rb: RbCtx): void {
  const local = localOf(rb);
  const bar = rb.els.top;

  const nav = node('div', 'rb-top-nav');
  const pill = backPillNode();
  if (pill) {
    nav.append(pill);
    // One Home per view: a pill that already goes Home does not get a twin.
    if (!pill.hasAttribute('data-back-home')) nav.append(homeFabEl());
  } else {
    nav.append(homeFabEl());
  }

  const title = node('div', 'rb-top-title');
  const name = node('h1', 'rb-top-name', tRaw('Rebrand'));
  const system = node('p', 'rb-top-system');
  // The Deck theme control sits beside the design system name (plan 275 section 6.3);
  // theme.ts fills the slot and keeps it.
  const line = node('div', 'rb-top-line');
  const theme = node('div', 'rb-top-theme');
  theme.hidden = true;
  line.append(system, theme);
  title.append(name, line);

  const actions = node('div', 'rb-top-actions');
  const save = node('p', 'rb-save');
  const saveText = node('span', 'rb-save-text');
  const saveAction = node('button', 'btn btn--ghost btn--sm rb-save-action');
  saveAction.type = 'button';
  save.append(saveText, saveAction);
  // Icon-only: the visible glyph never changes as the history moves, and the name and
  // the tooltip say the step.
  const history = node('div', 'rb-top-history');
  const undo = iconButton('rb-undo', tRaw('Undo'), 'undo');
  const redo = iconButton('rb-redo', tRaw('Redo'), 'redo');
  history.append(undo, redo);
  const more = iconButton('rb-top-more', tRaw('Project actions'), 'menuDots');
  more.setAttribute('aria-haspopup', 'menu');
  more.setAttribute('aria-expanded', 'false');
  // The panel primitive draws lp-iconbtn outside the cascade layers, so a `hidden` on
  // the button itself would not hide it; its wrapper takes the attribute instead.
  const menuSlot = node('div', 'rb-top-menu');
  menuSlot.append(more);
  actions.append(save, history, menuSlot);

  bar.setAttribute('aria-label', tRaw('Project'));
  bar.prepend(nav, title);
  local.versionInput = makeVersionInput(rb);
  bar.append(actions);
  mountBackPill(nav);

  local.els = {
    name,
    system,
    theme,
    save,
    saveText,
    saveAction,
    history,
    undo,
    redo,
    menuSlot,
    more,
  };

  undo.addEventListener('click', () => void rb.keys.step('undo'));
  redo.addEventListener('click', () => void rb.keys.step('redo'));
  more.addEventListener('click', () => openMenu(rb, more));
  saveAction.addEventListener('click', () => {
    if (saveAction.dataset.action === 'download') void downloadProject(rb);
    else if (saveAction.dataset.action === 'reload') void rb.controller.reload();
  });
  rb.disposers.push(() => localOf(rb).menu?.close(false));
}

export function renderTop(rb: RbCtx): void {
  const local = localOf(rb);
  const els = local.els;
  if (!els) return;
  const { state } = rb;
  // The theme control keeps its own memo, so it is drawn before this bar's.
  rb.theme.renderControl(els.theme);
  const project = state.project;
  const save = saveCopy(state.save);
  // A save state that needs the person (storage full, another tab) is said once as it arrives.
  if (state.save.kind !== local.saveKind) {
    const needsAction = state.save.kind === 'held' || state.save.kind === 'stale';
    if (needsAction && local.saveKind !== null) rb.announce(save.text);
    local.saveKind = state.save.kind;
  }
  // The newer-version pick is in the bar only while a plan can take one.
  const input = local.versionInput;
  const takesVersion = Boolean(state.plan) && state.mode === 'renovate' && state.phase === 'review' && Boolean(rb.controller.openNewerVersion);
  if (input && takesVersion !== input.isConnected) {
    if (takesVersion) rb.els.top.append(input);
    else input.remove();
  }
  const key = JSON.stringify([
    project?.id ?? null,
    project?.name ?? null,
    systemLine(rb),
    state.history,
    save,
    state.phase,
  ]);
  if (rb.memo.top === key) return;
  rb.memo.top = key;

  els.name.textContent = project?.name || state.source?.source.name || tRaw('Rebrand');
  const line = systemLine(rb);
  els.system.textContent = line;
  els.system.hidden = !line;

  const open = Boolean(project);
  els.save.hidden = !open || !save.text;
  els.save.dataset.kind = state.save.kind;
  // A fine state is said to a screen reader and shows nothing on screen.
  els.save.classList.toggle('visually-hidden', Boolean(save.fine));
  els.saveText.textContent = save.text;
  els.saveAction.hidden = !save.action;
  els.saveAction.dataset.action = save.action ?? '';
  els.saveAction.textContent = save.action === 'download' ? tRaw('Download .lolly') : save.action === 'reload' ? tRaw('Reload') : '';

  els.history.hidden = !state.plan;
  const undoText = undoLabel(state.history.undo);
  const redoText = redoLabel(state.history.redo);
  els.undo.setAttribute('aria-label', undoText);
  els.redo.setAttribute('aria-label', redoText);
  els.undo.title = undoText;
  els.redo.title = redoText;
  els.undo.disabled = !state.history.canUndo;
  els.redo.disabled = !state.history.canRedo;
  els.menuSlot.hidden = !open;
}

export function topOps(rb: RbCtx) {
  return {
    wire: bindOp(rb, wireTop),
    render: bindOp(rb, renderTop),
    download: bindOp(rb, downloadProject),
    close: bindOp(rb, closeProject),
    stepDone: bindOp(rb, stepDoneText),
    menuOpen: () => localOf(rb).menu?.isOpen() ?? false,
  };
}
