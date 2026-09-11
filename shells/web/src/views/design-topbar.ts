// SPDX-License-Identifier: MPL-2.0
/**
 * The Design editor's TOP BAR - plan 179 M1, slice A.
 *
 * One horizontal band docked to the top of `.tool-stage` carrying the document
 * identity (the Home pill, File menu, and document name) on the left, the view
 * verbs (undo/redo, the zoom cluster, the Timeline / Navigator / Inspector toggles)
 * in the centre, and the output verbs (Share, the Present split button, Export) plus
 * the profile avatar on the right.
 *
 * The three panel toggles are the ONLY show/hide controls those panels have from the
 * outside, so each one's `aria-pressed` has to keep following state the bar does not
 * own - see `onCanvasResize`.
 *
 * WHY A SEPARATE MODULE. Everything here could have been another template string
 * inside views/tool.ts, and then none of it could be tested: `mountTool` cannot be
 * imported in a node test (see the note at the top of tool-template-mount.test.ts).
 * So the bar is a module with an ALL-INJECTED option object - it imports nothing
 * from tool.ts or free-canvas.ts, and no stylesheet - and design-topbar.test.ts
 * drives it against fakes on a jsdom stage. tool.ts (slice B) supplies the real
 * ports; the stylesheet is imported there, beside editor.css.
 *
 * THE GEOMETRY CONTRACT is the only thing the bar does to anyone else's DOM: it
 * writes its own measured height to `--stage-reserve-top` on the stage and pokes
 * `canvas-resize` at the canvas, which is the mechanism tool.ts's fitCanvas already
 * honours (it reads the reserve bands and offsets the canvas wrapper). The write is
 * equality-guarded, exactly like free-canvas's reserveBottom and deck-editor's
 * syncFreeReserve: without the guard the bar's own dispatch wakes the stage
 * ResizeObserver, which re-measures, which dispatches again, forever. destroy()
 * puts the property back the way it found it.
 *
 * THE RIGHT-EDGE DOCK. There is ONE right-hand column in this editor (lib/edge-dock.ts)
 * and the compact zoom bar can take a slot in it, beside the export sheet and the
 * Inspector. Two copies of Fit / NN% / ± on one screen is the duplication this bar was
 * built to retire, so while that compact bar is docked the bar hides its own zoom
 * cluster, and puts it back the moment the column gives the bar up. The File menu stays beside the name, and the profile avatar MOVES: there is one avatar node in this editor, so the
 * bar hands it to `profileDock()` while the column is open and takes it back on the way
 * out - hiding it here instead would leave the page with no profile menu at all. Which
 * panels are docked is the host's business, so it arrives as an injected `dock` port -
 * injected rather than imported for the same reason as everything else here: the test
 * drives both states off a fake.
 *
 * UNITS. `zoom.actual()` and `zoom.subscribe()` speak ABSOLUTE zoom as a ratio of
 * native pixels - 1 means 100%, 0.5 means 50% - and `zoom.zoomTo()` takes the same
 * units. `zoom.zoomBy(f)` is a multiplier on the current view. Slice C's StageNav
 * additions must answer in those units or the readout lies.
 */
import { t } from '../i18n.ts';
import { isTypingTarget } from '../lib/typing-target.ts';
import { icon, type IconName } from '../lib/icons.ts';
import type { NarrationActions } from './design-ports.ts';

/**
 * Every capability the bar needs, injected. Nothing is imported from the editor:
 * that is what makes the bar mountable (and testable) on a bare jsdom stage.
 */
export interface DesignTopbarOpts {
  /** The positioned `.tool-stage` the bar docks into (it appends itself). */
  stageEl: HTMLElement;
  /** The canvas the `canvas-resize` event is aimed at (tool.ts's fitCanvas listens). */
  canvasEl: HTMLElement;
  /** `backHomeHtml()`'s markup for the Home pill island, inserted VERBATIM (see mount). */
  backPillHtml?: string;
  /**
   * The single-slot history contract tool.ts owns. `register` hands back a callback
   * the shell calls on every stack change - the bar is the one owner of that slot.
   */
  history: {
    undo(): void;
    redo(): void;
    register(sync: (canUndo: boolean, canRedo: boolean) => void): void;
  };
  revisions?: { open(): void };
  /** The document name: the export filename and the saved-session title. */
  name: {
    get(): string;
    set(v: string): void;
    /** The auto-filename shown when the field is empty. */
    placeholder(): string;
  };
  /** The job this otherwise general canvas is helping finish. It changes shell
   * guidance/defaults only; choosing one never rewrites document content. */
  intent?: {
    get(): string;
    set(value: string): void;
    options: ReadonlyArray<{ value: string; label: string }>;
  };
  /** Pan/zoom. All absolute ratios of native pixels (1 === 100%) - see the header. */
  zoom: {
    fitAll(): void;
    fitArtboard(): void;
    /** Multiply the current zoom (0.8 out, 1.25 in), about the stage centre. */
    zoomBy(f: number): void;
    /** Zoom to an absolute ratio (0.5 === 50%). */
    zoomTo(abs: number): void;
    /** The current absolute ratio. */
    actual(): number;
    /** Fires on every view change; returns the unsubscribe. */
    subscribe(cb: (scale: number) => void): () => void;
  };
  timeline: { toggle(): void; isOpen(): boolean };
  /** Live outcome gate. Static Design and Carousel keep motion chrome out of
   * the primary workspace; Slides, Video and Screencast restore it in place. */
  timelineEnabled?(): boolean;
  navigator: { toggle(): void; isOpen(): boolean };
  /**
   * The inspector column, when the host mounted one. OPTIONAL, and absent means no
   * button: an editor with no inspector must not grow a toggle for nothing. Present, it
   * is the column's ONLY show/hide control - the column itself has a close button but
   * nothing else could re-open it, so a wide screen was stuck with 280px of stage gone
   * and a narrow one (where it starts closed) could not reach the Document or Artboard
   * sections at all with nothing selected.
   */
  inspector?: { toggle(): void; isOpen(): boolean };
  /**
   * The right-edge dock, when the host has one. `zoomDocked()` is a LIVE read - true
   * while the compact zoom bar holds a slot in the column - and `subscribe` fires on
   * every change to who is docked, returning its own unsubscribe. Absent means the bar
   * keeps its zoom cluster at all times, which is what every host without a dock wants.
   */
  dock?: {
    zoomDocked(): boolean;
    subscribe(cb: () => void): () => void;
  };
  share(): void;
  /** Open the presenter. `at` is a frame id to start on; `speaker` opens speaker view. */
  present(o?: { at?: string; speaker?: boolean }): void;
  /** Open the export sheet (today's render popup), on `format` when one is named. */
  exportSheet(o?: { format?: string }): void;
  /**
   * Notes to voice for the whole deck (plans/180 section 8), offered as a row in the
   * Present split's menu. OPTIONAL: a host with no speech bridge passes nothing and the
   * row does not appear at all, rather than appearing and failing on press. `ready()` is
   * a live read - false when no slide carries speaker notes - which greys the row instead
   * of letting a press start a job with nothing to say.
  */
  narrate?: NarrationActions;
  /** Live outcome gate: a LinkedIn carousel has no spoken playback surface, while
   * slide/video outcomes may still use the same document's narration controls. */
  narrationEnabled?(): boolean;
  /** Top-level (non-blocks) inputs - the bar reads/writes `autoAdvance` only. */
  model: { getInput(id: string): unknown; setInput(id: string, v: unknown): void };
  /** The kiosk `?loop` flag, which lives on the URL rather than in the model. */
  loop: { get(): boolean; set(v: boolean): void };
  /** Open the document menu beside the filename (the overlay owns its items). */
  onFileMenu(anchor: HTMLElement): void;
  /** The profile avatar, docked at the bar's right end. Adopted, not cloned. */
  profileEl?: HTMLElement;
  /**
   * Where the avatar goes while the compact zoom bar holds the dock - the docked bar's
   * own element, or null when the host has nowhere to put it. There is one avatar node,
   * so it is HANDED OVER, not copied: the bar empties its slot only once the node is
   * somewhere else. Absent (or answering null) the bar keeps the avatar whatever the
   * dock is doing, because hiding a slot that still holds the only avatar leaves the
   * page with none.
   */
  profileDock?(): HTMLElement | null;
  /** False in a frame-less document: gates "Fit artboard" and "Present from this slide". */
  hasFrames(): boolean;
  /**
   * The frame "Present from this slide" starts on. OPTIONAL: without it the row still
   * works and the presenter falls back to its own address (`?s=`), so slice B can land
   * the mount call before the overlay grows `activeFrameId()`.
   */
  activeFrameId?(): string;
}

/** The mounted bar. `el` is already in the DOM. */
export interface DesignTopbar {
  el: HTMLElement;
  /** Re-read the name, the zoom readout, the two toggles and the frame gating. */
  sync(): void;
  /** Put the keyboard on the control that re-opens the inspector, for the host to call
   *  after the panel's own close button has taken the column off the page. */
  focusInspectorToggle(): void;
  destroy(): void;
}

// ── glyphs ────────────────────────────────────────────────────────────────────
// Every picture in the bar is a registry lookup (lib/icons.ts) - nothing is inlined
// here. The five below had no registry entry when the bar was written and were
// minted into PATHS rather than drawn locally (component audit rec 5, and the R3
// guard in primitive-guards.test.ts): undo/redo and `timeline` are the editor rail's
// own glyphs, so the bar and the rail now say the same thing with ONE picture, and
// the two fit glyphs are the corner-bracket "size" and the artboard "#".
const GLYPH = {
  undo: icon('undo'),
  redo: icon('redo'),
  fitAll: icon('fitAll'),
  fitArtboard: icon('fitArtboard'),
  timeline: icon('timeline'),
};

/** The zoom menu's fixed stops, in absolute ratio. */
const ZOOM_STOPS: Array<[number, string]> = [[0.5, '50%'], [1, '100%'], [2, '200%'], [4, '400%']];

/** Keep the outcome legible after density hides its text label. A bare down-chevron
 * looked like an unlabeled disclosure on phones, precisely where this control is the
 * quickest way to correct an inferred outcome. */
function intentGlyph(value: string): string {
  const kind: IconName = value === 'slides' ? 'document'
    : value === 'carousel' ? 'image'
      : value === 'video' ? 'filmStrip'
        : value === 'screencast' ? 'monitor'
          : 'shapes';
  return icon(kind, { className: 'dtb-intent-kind' })
    + icon('chevronDown', { className: 'dtb-intent-caret' });
}

/** One row in a bar menu. `checked` present ⇒ the row is a checkbox and keeps the menu open. */
/** The modifier's name for a tooltip hint: the Mac glyph, or the word everywhere else. */
const ALT_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '') ? '⌥' : 'Alt+';

interface MenuRow {
  label: string;
  glyph?: string;
  disabled?: boolean;
  /** Why the row is off, in one short sentence. Shown under the label and read as part
   *  of the row's accessible name, so a greyed control explains itself. */
  reason?: string;
  /**
   * A LIVE READ off the port, not a snapshot: the row is built from it and re-reads
   * it after every run, so the tick reports what the port actually holds rather than
   * what the click asked for. See the click handler in toggleMenu for why.
   */
  checked?: () => boolean;
  run(): void;
}

export function mountDesignTopbar(opts: DesignTopbarOpts): DesignTopbar {
  const doc = opts.stageEl.ownerDocument;

  // ── root ────────────────────────────────────────────────────────────────────
  const root = doc.createElement('div');
  root.className = 'design-topbar';
  root.setAttribute('role', 'toolbar');
  root.setAttribute('aria-label', t('Design tools'));
  // Contracts, not decoration: [data-export-hide] keeps the bar out of every render
  // (bridge/export.ts detaches it from the stage), [data-live-hide] out of a live
  // capture (bridge/live-capture.ts's injected sheet hides it), the way .stage-nav does.
  root.setAttribute('data-export-hide', '');
  root.setAttribute('data-live-hide', '');
  // The canvas-keyboard opt-out. free-canvas binds the editor's bare-key verbs on
  // `window`, so a focused button in this bar was a live canvas surface: Delete on the
  // Export button removed the selection, an arrow key in a menu nudged a box. The bar
  // already stops its own keys on the way out (`onRootKey` below), and this attribute is
  // the same statement made where free-canvas can read it - one check for every chrome
  // root that carries focusable controls over the canvas, rather than a class list.
  root.setAttribute('data-canvas-keys', 'off');

  // Inserted VERBATIM - backHomeHtml() emits its own `.chrome-topleft` island and
  // mountBackPill() (called later, over the whole view) finds `[data-back-pill]`
  // wherever it sits, so the unsaved-changes intercept keeps working. The island's
  // own `position: fixed` is neutralised by design-topbar.css, not by touching it here.
  if (opts.backPillHtml) {
    const holder = doc.createElement('div');
    holder.innerHTML = opts.backPillHtml;
    while (holder.firstChild) root.appendChild(holder.firstChild);
  }

  // ── left: Home, File menu, document name ──────────────────────────────
  const fileBtn = mkBtn('file', t('File menu'), icon('menu'));
  fileBtn.setAttribute('aria-haspopup', 'menu');
  // The File menu is the OVERLAY's popover, not one of ours (`onFileMenu` hands the
  // anchor over and free-canvas spawns it), so the state is written by whoever owns the
  // menu - free-canvas's spawnPopover/closePopover flip this attribute on the trigger it
  // was given. It has to exist for them to find, which is why it is stamped here.
  fileBtn.setAttribute('aria-expanded', 'false');
  fileBtn.addEventListener('click', () => { closeMenu(); opts.onFileMenu(fileBtn); });
  root.appendChild(fileBtn);

  const nameInput = doc.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'dtb-name';
  nameInput.setAttribute('data-topbar', 'name');
  nameInput.setAttribute('aria-label', t('Document name'));
  nameInput.spellcheck = false;
  root.appendChild(nameInput);
  /**
   * The full name on hover once the field has cut it short (plans/184 section 6, S8):
   * "Design-lo…" at 860px had no way to be read whole. A native title, because an
   * <input> is a replaced element and draws no ::after bubble. Re-read on every sync
   * and every measure, since the density steps change the field's width.
   */
  function syncNameTip(): void {
    const clipped = nameInput.value !== '' && nameInput.scrollWidth > nameInput.clientWidth + 1;
    nameInput.title = clipped ? nameInput.value : t('Rename this design');
  }
  syncNameTip();

  const intentBtn = opts.intent
    ? mkBtn('intent', t('Design outcome'), intentGlyph(opts.intent.get()), {
        cls: 'dtb-intent', text: opts.intent.options.find(o => o.value === opts.intent!.get())?.label ?? t('Design'),
      })
    : null;
  if (intentBtn) {
    intentBtn.setAttribute('aria-haspopup', 'menu');
    intentBtn.setAttribute('aria-expanded', 'false');
    intentBtn.addEventListener('click', () => toggleMenu(intentBtn, intentRows(), 'start'));
    root.appendChild(intentBtn);
  }

  // ── centre: history, zoom, panels ───────────────────────────────────────────
  const centre = doc.createElement('div');
  centre.className = 'dtb-centre';
  root.appendChild(centre);

  const undoBtn = mkBtn('undo', t('Undo'), GLYPH.undo);
  const redoBtn = mkBtn('redo', t('Redo'), GLYPH.redo);
  undoBtn.addEventListener('click', () => opts.history.undo());
  redoBtn.addEventListener('click', () => opts.history.redo());
  centre.append(undoBtn, redoBtn, sep());
  if (opts.revisions) {
    const revisionsBtn = mkBtn('history', t('History'), icon('history'));
    revisionsBtn.addEventListener('click', () => opts.revisions?.open());
    centre.append(revisionsBtn);
  }

  const fitAllBtn = mkBtn('fit-all', t('Fit all'), GLYPH.fitAll, { text: t('Fit all') });
  const fitArtBtn = mkBtn('fit-artboard', t('Fit artboard'), GLYPH.fitArtboard, { text: t('Fit artboard') });
  fitAllBtn.addEventListener('click', () => opts.zoom.fitAll());
  fitArtBtn.addEventListener('click', () => opts.zoom.fitArtboard());

  // No glyph: the percentage reads as the control, and design-topbar.css exempts
  // this one label from the under-900px icon-only collapse for the same reason.
  const zoomBtn = mkBtn('zoom-level', t('Zoom level'), '', { cls: 'dtb-zoom-level', text: '100%' });
  zoomBtn.setAttribute('aria-haspopup', 'menu');
  zoomBtn.setAttribute('aria-expanded', 'false');
  zoomBtn.addEventListener('click', () => toggleMenu(zoomBtn, zoomRows(), 'start'));

  const zoomOutBtn = mkBtn('zoom-out', t('Zoom out'), icon('zoomOut'));
  const zoomInBtn = mkBtn('zoom-in', t('Zoom in'), icon('zoomIn'));
  zoomOutBtn.addEventListener('click', () => opts.zoom.zoomBy(0.8));
  zoomInBtn.addEventListener('click', () => opts.zoom.zoomBy(1.25));
  // One group, so the five zoom verbs (and the rule that follows them) hide and return
  // together when the compact zoom bar takes the dock - see syncDock. Its own separator
  // travels inside it: hiding the cluster and leaving a floating rule behind it reads as
  // a control that failed to paint.
  const zoomGroup = doc.createElement('span');
  zoomGroup.className = 'dtb-group';
  zoomGroup.setAttribute('data-topbar-group', 'zoom');
  zoomGroup.append(fitAllBtn, fitArtBtn, zoomBtn, zoomOutBtn, zoomInBtn, sep());
  centre.append(zoomGroup);

  const timelineBtn = mkBtn('timeline', t('Timeline'), GLYPH.timeline, { text: t('Timeline') });
  timelineBtn.setAttribute('aria-pressed', 'false');
  timelineBtn.setAttribute('data-tip', `${t('Timeline')} (${ALT_KEY}1)`);
  timelineBtn.addEventListener('click', () => {
    if (opts.timelineEnabled?.() === false) return;
    opts.timeline.toggle();
    syncToggles();
  });
  const navBtn = mkBtn('navigator', t('Navigator'), icon('dock'), { text: t('Navigator') });
  navBtn.setAttribute('aria-pressed', 'false');
  navBtn.setAttribute('data-tip', `${t('Navigator')} (${ALT_KEY}2)`);
  navBtn.addEventListener('click', () => { opts.navigator.toggle(); syncToggles(); });
  centre.append(timelineBtn, navBtn);
  const inspBtn = opts.inspector ? mkBtn('inspector', t('Inspector'), icon('sliders'), { text: t('Inspector') }) : null;
  if (inspBtn) {
    inspBtn.setAttribute('aria-pressed', 'false');
    inspBtn.setAttribute('data-tip', `${t('Inspector')} (${ALT_KEY}3)`);
    inspBtn.addEventListener('click', () => { opts.inspector?.toggle(); syncToggles(); });
    centre.append(inspBtn);
  }

  // ── right: share, present split, export, profile ────────────────────────────
  const right = doc.createElement('div');
  right.className = 'dtb-right';
  root.appendChild(right);

  // The hamburger: where the centre cluster (and, tighter still, Share and the Present
  // rows) folds when the bar's OWN width runs out - see syncDensity. Hidden at full width.
  const moreBtn = mkBtn('more', t('More actions'), icon('menu'));
  moreBtn.setAttribute('aria-haspopup', 'menu');
  moreBtn.setAttribute('aria-expanded', 'false');
  moreBtn.hidden = true;
  moreBtn.addEventListener('click', () => toggleMenu(moreBtn, moreRows(), 'end'));
  right.appendChild(moreBtn);

  const shareBtn = mkBtn('share', t('Share'), icon('share'), { text: t('Share') });
  shareBtn.addEventListener('click', () => opts.share());
  right.appendChild(shareBtn);

  const split = doc.createElement('div');
  split.className = 'dtb-split';
  const presentLabel = (): string => opts.intent && opts.intent.get() !== 'slides' ? t('Preview') : t('Present');
  const presentBtn = mkBtn('present', presentLabel(), icon('play'), { cls: 'dtb-split-main', text: presentLabel() });
  presentBtn.addEventListener('click', () => opts.present());
  const presentMenuBtn = mkBtn('present-menu', t('Present options'), icon('chevronDown'), { cls: 'dtb-split-caret' });
  presentMenuBtn.setAttribute('aria-haspopup', 'menu');
  presentMenuBtn.setAttribute('aria-expanded', 'false');
  presentMenuBtn.addEventListener('click', () => toggleMenu(presentMenuBtn, presentRows(), 'end'));
  split.append(presentBtn, presentMenuBtn);
  right.appendChild(split);

  const exportBtn = mkBtn('export', t('Export'), icon('upload'), { cls: 'dtb-primary', text: t('Export') });
  exportBtn.addEventListener('click', () => opts.exportSheet());
  right.appendChild(exportBtn);

  const profileEl = opts.profileEl ?? null;
  let profileSlot: HTMLElement | null = null;
  if (profileEl) {
    profileSlot = doc.createElement('div');
    profileSlot.className = 'dtb-profile';
    profileSlot.appendChild(profileEl);
    right.appendChild(profileSlot);
  }

  opts.stageEl.appendChild(root);

  // ── menus ───────────────────────────────────────────────────────────────────
  // Deliberately NOT free-canvas's spawnPopover: importing it would drag the whole
  // overlay (and its stylesheet) into this module and back out of node's reach.
  let openEl: HTMLElement | null = null;
  let openAnchor: HTMLElement | null = null;

  function closeMenu(restoreFocus = false): void {
    if (!openEl) return;
    const anchor = openAnchor;
    openEl.remove();
    openEl = null;
    openAnchor = null;
    if (anchor) {
      if (anchor.hasAttribute('aria-expanded')) anchor.setAttribute('aria-expanded', 'false');
      if (restoreFocus) anchor.focus();
    }
  }

  function toggleMenu(anchor: HTMLElement, rows: MenuRow[], align: 'start' | 'end'): void {
    if (openAnchor === anchor) { closeMenu(true); return; }
    closeMenu();
    const menu = doc.createElement('div');
    menu.className = 'dtb-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', anchor.getAttribute('aria-label') || '');
    menu.style.top = '100%';
    // offsetLeft is measured against `root` (the nearest positioned ancestor), so the
    // menu hangs under its own trigger without a client-rect read.
    if (align === 'end') menu.style.right = Math.max(0, root.clientWidth - (anchor.offsetLeft + anchor.offsetWidth)) + 'px';
    else menu.style.left = Math.max(0, anchor.offsetLeft) + 'px';

    for (const row of rows) {
      const item = doc.createElement('button');
      item.type = 'button';
      item.className = 'dtb-menu-item';
      item.tabIndex = -1;
      item.setAttribute('role', row.checked ? 'menuitemcheckbox' : 'menuitem');
      if (row.checked) item.setAttribute('aria-checked', row.checked() ? 'true' : 'false');
      // `aria-disabled`, never the `disabled` PROPERTY. A disabled button is removed from
      // the arrow-key ring below and never reaches a screen reader, so a row that exists
      // to be discoverable ("Narrate", greyed until a slide has notes) was invisible to
      // exactly the users who most need to be told it is there. APG's menu pattern keeps
      // a disabled item focusable; the click handler is what refuses the press.
      if (row.disabled) item.setAttribute('aria-disabled', 'true');
      item.appendChild(icBox('dtb-menu-ic', row.glyph ?? ''));
      const label = doc.createElement('span');
      label.className = 'dtb-menu-label';
      label.textContent = row.label;
      // The reason rides INSIDE the button, so it is part of the row's accessible name
      // rather than a title tip a touch device never fires.
      if (row.disabled && row.reason) {
        const why = doc.createElement('span');
        why.className = 'dtb-menu-why';
        why.textContent = row.reason;
        label.appendChild(why);
      }
      item.appendChild(label);
      item.addEventListener('click', () => {
        if (item.getAttribute('aria-disabled') === 'true') return;
        row.run();
        // A checkbox row keeps the menu up (you may want to set both), and re-reads
        // THE PORT rather than flipping its own attribute. `loop.set()` is a URL
        // write and `setInput()` goes through the runtime; either can refuse, clamp
        // or normalise what it was handed (kiosk on a frame-less document, a
        // validator rejecting the value). A blind flip would then show the opposite
        // of the truth for as long as the menu stays open - and a checkbox row
        // deliberately keeps it open, so that is the whole interaction.
        if (!row.checked) closeMenu(true);
        else item.setAttribute('aria-checked', row.checked() ? 'true' : 'false');
      });
      menu.appendChild(item);
    }

    menu.addEventListener('keydown', onMenuKey);
    root.appendChild(menu);
    openEl = menu;
    openAnchor = anchor;
    if (anchor.hasAttribute('aria-expanded')) anchor.setAttribute('aria-expanded', 'true');
    items(menu)[0]?.focus();
  }

  // Every row, greyed ones included: aria-disabled keeps a row in the ring on purpose
  // (see the build above), and only `disabled` would take one out of it.
  const items = (menu: HTMLElement): HTMLButtonElement[] =>
    Array.from(menu.querySelectorAll<HTMLButtonElement>('.dtb-menu-item')).filter(b => !b.disabled);

  function onMenuKey(e: KeyboardEvent): void {
    if (!openEl) return;
    const list = items(openEl);
    const at = list.indexOf(doc.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(true); return; }
    // Tab leaves the menu the way the APG menu-button pattern says: close, put focus
    // back on the trigger, and let the DEFAULT run - sequential focus navigation is
    // resolved after the handler, so the browser continues from the trigger to the next
    // bar control. Without the hand-off the menu is removed with focus
    // still inside it, focus falls to <body>, and Tab restarts at the top of the page.
    if (e.key === 'Tab') { closeMenu(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); list[(at + 1 + list.length) % list.length]?.focus(); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); list[(at - 1 + list.length) % list.length]?.focus(); return; }
    if (e.key === 'Home') { e.preventDefault(); list[0]?.focus(); return; }
    if (e.key === 'End') { e.preventDefault(); list[list.length - 1]?.focus(); }
  }

  const onDocPointer = (e: Event): void => {
    if (!openEl) return;
    const target = e.target as Node | null;
    if (target && (openEl.contains(target) || openAnchor?.contains(target))) return;
    closeMenu();
  };
  doc.addEventListener('pointerdown', onDocPointer, true);

  /**
   * THE GATE. free-canvas binds its canvas shortcuts on `window` and bails only for a
   * typing target or focus inside `.tl-panel` - a `<button>` in this bar is neither. So
   * every control here was a live canvas keyboard surface: Backspace on the focused
   * Export button deleted the selected box, ArrowDown on a menu row nudged it a pixel
   * and pushed an undo step, `v`/`p`/`n` switched tools, `\` hid all the chrome, and
   * Space armed the canvas pan while the user was activating a button with it.
   *
   * The bar cannot edit that handler, so it stops its own keys on the way out - the same
   * three lines, for the same reason, as the navigator column's `onRootKey`. App-wide
   * chords still travel: they carry meta/ctrl and mean the same thing wherever focus is
   * (⌘Z is the tool view's undo, ⌘S its save, both bound on `window` too). The name
   * field and the menus keep their own handlers; this is the belt under them.
   */
  const onRootKey = (e: KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey) return;
    // Escape belongs to the editor's own ladder wherever the focus is - it is how you
    // leave a mode, a draft or a selection - and an open menu of ours has already
    // stopped it in `onMenuKey` before this listener could see it.
    if (e.key === 'Escape') return;
    e.stopPropagation();
  };
  root.addEventListener('keydown', onRootKey);

  function zoomRows(): MenuRow[] {
    const rows: MenuRow[] = ZOOM_STOPS.map(([abs, label]) => ({
      // Verbatim, for the same reason setZoomLabel writes its readout raw: a numeral
      // and a sign, not prose. Sending these through t() would mint four numeral-only
      // rows in all 26 locale catalogs that no translator can improve, and would leave
      // the same number a catalog key here and a bare string in the readout beside it.
      label,
      run: () => opts.zoom.zoomTo(abs),
    }));
    rows.push({ label: t('Fit all'), glyph: GLYPH.fitAll, run: () => opts.zoom.fitAll() });
    rows.push({ label: t('Fit artboard'), glyph: GLYPH.fitArtboard, disabled: !opts.hasFrames(), run: () => opts.zoom.fitArtboard() });
    return rows;
  }

  function presentRows(): MenuRow[] {
    const narrate = opts.narrationEnabled?.() === false ? undefined : opts.narrate;
    return [
      {
        label: t('Present from this slide'),
        glyph: icon('play'),
        disabled: !opts.hasFrames(),
        run: () => opts.present({ at: opts.activeFrameId?.() || undefined }),
      },
      { label: t('Speaker view'), glyph: icon('monitor'), run: () => opts.present({ speaker: true }) },
      // Notes to voice for the whole deck (plans/180 M-A). The row sits with the other
      // present-time verbs because that is what narration IS - the deck saying itself -
      // and it is greyed rather than hidden when no slide has notes yet, so the way to
      // get a narrated deck is discoverable from the same menu that presents it.
      ...(narrate
        ? [{
          label: t('Narrate'),
          glyph: icon('speech'),
          disabled: !opts.hasFrames() || narrate.ready?.() === false,
          reason: !opts.hasFrames()
            ? t('Add an artboard first.')
            : (narrate.reason?.() || t('No slide has speaker notes yet.')),
          run: () => narrate.narrateAll(),
        }]
        : []),
      {
        label: t('Auto-advance slides'),
        checked: () => opts.model.getInput('autoAdvance') === true,
        run: () => opts.model.setInput('autoAdvance', opts.model.getInput('autoAdvance') !== true),
      },
      {
        label: t('Loop the deck (kiosk)'),
        checked: () => opts.loop.get() === true,
        run: () => opts.loop.set(!opts.loop.get()),
      },
      // The deck as a moving picture (plans/184 R3): the export panel places the slides
      // on a temporary timeline for the render, each for its own dwell, with the deck's
      // slide transition between them. Last, after the presenter's own settings, because
      // it leaves the podium for the export sheet.
      {
        label: t('Export slides as video'),
        glyph: icon('filmStrip'),
        disabled: !opts.hasFrames(),
        reason: !opts.hasFrames() ? t('Add an artboard first.') : undefined,
        run: () => opts.exportSheet({ format: 'mp4' }),
      },
    ];
  }

  function intentRows(): MenuRow[] {
    return (opts.intent?.options ?? []).map(option => ({
      label: option.label,
      checked: () => opts.intent?.get() === option.value,
      run: () => { opts.intent?.set(option.value); sync(); },
    }));
  }

  // ── panel shortcuts ─────────────────────────────────────────────────────────
  // Alt+1 / Alt+2 / Alt+3 toggle Timeline, Navigator and Inspector (plans/184 section 6,
  // S4) - the keys Figma gives its panels, and unbound in every browser (Cmd/Ctrl+digit
  // switches tabs; Alt+digit alone means nothing). Read by `code`, since a Mac reports
  // Alt+1 as the key "¡". Never while typing: a field keeps its own keys. Bound on the
  // document because the bar never holds focus - it is the stage's chrome, not a panel.
  const PANEL_KEYS: Record<string, (() => void) | undefined> = {
    Digit1: () => opts.timeline.toggle(),
    Digit2: () => opts.navigator.toggle(),
    Digit3: opts.inspector ? () => opts.inspector?.toggle() : undefined,
  };
  function onPanelKey(e: KeyboardEvent): void {
    if (!e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (e.code === 'Digit1' && opts.timelineEnabled?.() === false) return;
    const run = PANEL_KEYS[e.code];
    if (!run || isTypingTarget(e.target as Element | null)) return;
    e.preventDefault();
    run();
    syncToggles();
  }
  doc.addEventListener('keydown', onPanelKey);

  // ── the geometry contract ───────────────────────────────────────────────────
  // Whatever the stage carried before the bar arrived, so destroy() can put it back
  // rather than assuming the property was ours to delete.
  const priorReserve = opts.stageEl.style.getPropertyValue('--stage-reserve-top');
  let lastReserve = priorReserve;

  function measure(): void {
    syncNameTip();
    const next = Math.round(root.offsetHeight || 0) + 'px';
    if (next === lastReserve) return;      // the guard: our own dispatch wakes the stage RO
    lastReserve = next;
    opts.stageEl.style.setProperty('--stage-reserve-top', next);
    // The right edge dock is a body-level fixed column and cannot read the stage's inline
    // style, so the bar's height is published on <html> as well: the dock starts below it.
    document.documentElement.style.setProperty('--design-topbar-h', next);
    opts.canvasEl.dispatchEvent(new Event('canvas-resize'));
  }

  const RO = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
  const ro = typeof RO === 'function' ? new RO(() => { syncDensity(); measure(); }) : null;
  ro?.observe(root);

  /**
   * The two panel toggles report state the bar does not own, and both panels can be
   * opened from somewhere else: the timeline from the tool rail, from the inspector's
   * Motion door and by a document that arrives already timed; the navigator from its own
   * collapse control. `syncToggles()` otherwise ran only from the two click handlers, so
   * a panel opened elsewhere left its button saying `aria-pressed="false"` - a screen
   * reader told the panel was off while it was on, and the pressed styling missing.
   *
   * `canvas-resize` is the signal, because opening or closing either panel changes a
   * stage reserve and every writer of those dispatches this event at the canvas (that is
   * the mechanism fitCanvas already rides). It costs two attribute reads and ends up
   * in the same place a click would.
   */
  const onCanvasResize = (): void => syncToggles();
  opts.canvasEl.addEventListener('canvas-resize', onCanvasResize);

  // ── wiring ──────────────────────────────────────────────────────────────────
  let syncing = false;
  nameInput.addEventListener('input', () => { if (!syncing) opts.name.set(nameInput.value); });
  // Enter commits by leaving the field - there is nothing else to submit, and a stray
  // form submit or a canvas shortcut firing mid-rename would both be wrong.
  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); nameInput.blur(); }
    e.stopPropagation();
  });

  // Dead until the shell says otherwise: a fresh mount has no history, and tool.ts's
  // register() calls straight back with the real pair, so this is only ever the state
  // between construction and that call.
  undoBtn.disabled = true;
  redoBtn.disabled = true;
  opts.history.register((canUndo, canRedo) => {
    // If the button that ran the action is about to disable itself (the last undo,
    // pressed from the keyboard), hand focus to its now-enabled sibling FIRST: a
    // disabled button drops focus to <body>, and the next Tab then restarts at the
    // top of the document instead of landing on the neighbouring control. Same
    // hand-off, for the same reason, as the sidebar pair this bar supersedes
    // (historyControls.sync in views/tool.ts).
    const active = doc.activeElement;
    if (active === undoBtn && !canUndo && canRedo) redoBtn.focus();
    else if (active === redoBtn && !canRedo && canUndo) undoBtn.focus();
    undoBtn.disabled = !canUndo;
    redoBtn.disabled = !canRedo;
  });

  function setZoomLabel(abs: number): void {
    const pct = Number.isFinite(abs) && abs > 0 ? Math.round(abs * 100) : 100;
    // A numeral and a sign, not prose - no catalog row to translate.
    const span = zoomBtn.querySelector('.dtb-label');
    if (span) span.textContent = `${pct}%`;
  }
  const unsubZoom = opts.zoom.subscribe(setZoomLabel);

  function syncToggles(): void {
    const hideTimeline = opts.timelineEnabled?.() === false;
    const timelineVisibilityChanged = timelineBtn.hidden !== hideTimeline;
    timelineBtn.hidden = hideTimeline;
    timelineBtn.setAttribute('aria-pressed', opts.timeline.isOpen() ? 'true' : 'false');
    navBtn.setAttribute('aria-pressed', opts.navigator.isOpen() ? 'true' : 'false');
    inspBtn?.setAttribute('aria-pressed', opts.inspector?.isOpen() ? 'true' : 'false');
    if (timelineVisibilityChanged) syncDensity();
  }

  /**
   * The inspector's own header close button takes the whole column off the page, and a
   * removed subtree drops focus to <body> - so the next Tab restarted at the top of the
   * document instead of continuing from where the panel had been. This toggle is the only
   * control that re-opens it, so it takes the keyboard. Folded away at compact density,
   * where the hamburger carries the Inspector row and stands in for it.
   */
  function focusInspectorToggle(): void {
    const target = inspBtn && !inspBtn.hidden && !centre.hidden ? inspBtn : moreBtn;
    if (!target.hidden) target.focus();
  }

  /**
   * The zoom cluster is the bar's, UNLESS the compact zoom bar is holding a slot in the
   * right-edge column - then the column carries Fit / NN% / ± and the bar would be the
   * second of two zoom controls on one screen, which is the thing this bar retired the
   * floating swirl pill to avoid. Hiding it also changes the bar's measured height on a
   * narrow window, so the reserve is re-measured on the way out.
   */
  function syncDock(): void {
    const hide = !!opts.dock?.zoomDocked();
    if (zoomGroup.hidden === hide) return;
    zoomGroup.hidden = hide;
    // The avatar rides the docked bar too (Andy: the zoom, theme and profile controls
    // belong to the right dock while it is open). One node, so this is a MOVE, not a
    // hide: the bar used to empty its slot and leave the avatar inside it, which took
    // the profile menu off the screen entirely for as long as the column was open.
    // No home offered? The avatar stays here, visible, rather than nowhere.
    if (profileSlot && profileEl) {
      const home = (hide ? opts.profileDock?.() : null) ?? null;
      const target = home ?? profileSlot;
      if (profileEl.parentElement !== target) target.appendChild(profileEl);
      profileSlot.hidden = !!home;
    }
    measure();
  }
  const unsubDock = opts.dock?.subscribe(() => syncDock()) ?? null;

  // ── density: the bar folds by its OWN width, never by the viewport ─────────────
  // The sidebars and the right dock steal width from the bar, so a viewport media
  // query fires at the wrong moment (a 1400px window with both columns open leaves
  // the bar about 800px). The ladder: full (labels) -> icons (labels visually hidden)
  // -> compact (the centre cluster folds into the hamburger) -> min (Share and the
  // Present caret fold too, leaving mark, name, Present, Export, hamburger). Each step
  // is tried widest-first on every resize, so the bar climbs back up as room returns.
  // Andy, 2026-09-03: "collapse the top toolbar to icons and then to a hamburger menu",
  // with "responsive breaks for tablet and mobile".
  type Density = 'full' | 'icons' | 'compact' | 'min';
  const DENSITY_ORDER: Density[] = ['full', 'icons', 'compact', 'min'];
  let density: Density | '' = '';
  function fits(): boolean {
    // Content wider than the bar overflows its flex row: the right group's far edge
    // tells. Measured in the bar's own box, so the columns' theft is already counted.
    const r = root.getBoundingClientRect();
    const b = right.getBoundingClientRect();
    if (!r.width) return true;   // detached or unpainted (jsdom): stay at full
    return b.right <= r.right - 8;
  }
  function applyDensity(d: Density): void {
    if (density === d) return;
    density = d;
    root.setAttribute('data-density', d);
    const folded = d === 'compact' || d === 'min';
    centre.hidden = folded;
    moreBtn.hidden = !folded;
    shareBtn.hidden = d === 'min';
    presentMenuBtn.hidden = d === 'min';
  }
  function syncDensity(): void {
    if (!root.isConnected) return;
    const before = density;
    applyDensity('full');
    for (let i = 0; i < DENSITY_ORDER.length - 1 && !fits(); i++) applyDensity(DENSITY_ORDER[i + 1]!);
    if (density !== before) measure();
  }
  function moreRows(): MenuRow[] {
    const rows: MenuRow[] = [
      { label: t('Undo'), glyph: GLYPH.undo, disabled: undoBtn.disabled, run: () => opts.history.undo() },
      { label: t('Redo'), glyph: GLYPH.redo, disabled: redoBtn.disabled, run: () => opts.history.redo() },
    ];
    if (opts.revisions) rows.push({ label: t('History'), glyph: icon('history'), run: () => opts.revisions?.open() });
    if (!zoomGroup.hidden) {
      rows.push(
        { label: t('Fit all'), glyph: GLYPH.fitAll, run: () => opts.zoom.fitAll() },
        { label: t('Fit artboard'), glyph: GLYPH.fitArtboard, disabled: !opts.hasFrames(), run: () => opts.zoom.fitArtboard() },
        { label: t('Zoom in'), glyph: icon('zoomIn'), run: () => opts.zoom.zoomBy(1.25) },
        { label: t('Zoom out'), glyph: icon('zoomOut'), run: () => opts.zoom.zoomBy(0.8) },
      );
    }
    if (opts.timelineEnabled?.() !== false)
      rows.push({ label: t('Timeline'), glyph: GLYPH.timeline, checked: () => opts.timeline.isOpen(), run: () => opts.timeline.toggle() });
    rows.push({ label: t('Navigator'), glyph: icon('dock'), checked: () => opts.navigator.isOpen(), run: () => opts.navigator.toggle() });
    if (opts.inspector) rows.push({ label: t('Inspector'), glyph: icon('sliders'), checked: () => !!opts.inspector?.isOpen(), run: () => opts.inspector?.toggle() });
    if (density === 'min') {
      rows.push({ label: t('Share'), glyph: icon('share'), run: () => opts.share() });
      rows.push(...presentRows());
    }
    return rows;
  }

  function sync(): void {
    syncing = true;
    // Guarded, because sync() now also runs while the user is TYPING in this field: the
    // host echoes the export sheet's filename input back here on every `input` event so
    // a rename made over there cannot go stale, and that echo arrives mid-word. Writing
    // an identical value is not free in every engine (it can collapse the selection), so
    // an unchanged name is left completely alone.
    const nextName = opts.name.get();
    if (nameInput.value !== nextName) nameInput.value = nextName;
    syncNameTip();
    // The auto-filename when there is one, and a word rather than an empty grey box
    // when there is not - a nameless document still has to look like a document.
    nameInput.placeholder = opts.name.placeholder() || t('Untitled');
    if (intentBtn && opts.intent) {
      const label = opts.intent.options.find(o => o.value === opts.intent!.get())?.label ?? t('Design');
      const span = intentBtn.querySelector<HTMLElement>('.dtb-label');
      if (span) span.textContent = label;
      const glyph = intentBtn.querySelector<HTMLElement>('.dtb-ic');
      if (glyph) glyph.replaceWith(icBox('dtb-ic', intentGlyph(opts.intent.get())));
      intentBtn.setAttribute('data-tip', t('Design outcome: {outcome}', { outcome: label }));
    }
    const nextPresentLabel = presentLabel();
    presentBtn.setAttribute('aria-label', nextPresentLabel);
    presentBtn.setAttribute('data-tip', nextPresentLabel);
    const presentText = presentBtn.querySelector<HTMLElement>('.dtb-label');
    if (presentText) presentText.textContent = nextPresentLabel;
    syncing = false;
    setZoomLabel(opts.zoom.actual());
    syncToggles();
    syncDock();
    const framed = opts.hasFrames();
    fitArtBtn.disabled = !framed;
    measure();
  }

  sync();

  return {
    el: root,
    sync,
    focusInspectorToggle,
    destroy() {
      doc.removeEventListener('keydown', onPanelKey);
      closeMenu();
      doc.removeEventListener('pointerdown', onDocPointer, true);
      root.removeEventListener('keydown', onRootKey);
      opts.canvasEl.removeEventListener('canvas-resize', onCanvasResize);
      ro?.disconnect();
      try { unsubZoom(); } catch { /* a fake port may not return one */ }
      try { unsubDock?.(); } catch { /* same */ }
      if (lastReserve !== priorReserve) {
        if (priorReserve) opts.stageEl.style.setProperty('--stage-reserve-top', priorReserve);
        else opts.stageEl.style.removeProperty('--stage-reserve-top');
        opts.canvasEl.dispatchEvent(new Event('canvas-resize'));
      }
      document.documentElement.style.removeProperty('--design-topbar-h');
      root.remove();
    },
  };

  // ── local builders ──────────────────────────────────────────────────────────
  /**
   * The bar's ONE glyph sink: a `<span class="…">` around a glyph STRING. Every
   * caller passes `icon()` output (lib/icons.ts) or the static `LOLLY_MARK_SVG`
   * brand mark - never a document value, a name the user typed, or anything read
   * back off the model - so nothing interpolated here can carry markup. Buttons and
   * menu rows share it so the inventory in primitive-guards.test.ts (R10) counts one
   * site to review, not one per control.
   */
  function icBox(cls: string, svg: string): HTMLElement {
    const box = doc.createElement('span');
    box.className = cls;
    box.innerHTML = svg;
    return box;
  }

  /**
   * One bar control. `aria` is ALWAYS set, so an icon-only button and the same
   * button with its text label showing carry the identical accessible name - which
   * is what lets design-topbar.css hide `.dtb-label` under 900px for free.
   */
  function mkBtn(id: string, aria: string, svg: string, o: { cls?: string; text?: string } = {}): HTMLButtonElement {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'dtb-btn' + (o.cls ? ` ${o.cls}` : '');
    b.setAttribute('data-topbar', id);
    b.setAttribute('aria-label', aria);
    // The app's ONE tooltip (styles/parts/tooltip.css), not a native title: title is
    // invisible to keyboard and touch and drew under the cursor while the rail beside
    // this bar bubbled (plans/184 section 6, S6). Below, since the bar hugs the top of
    // the stage; design-topbar.css keeps the bubble off a button whose label shows.
    b.setAttribute('data-tip', aria);
    b.setAttribute('data-tip-below', '');
    if (svg) b.appendChild(icBox('dtb-ic', svg));
    if (o.text) {
      const label = doc.createElement('span');
      label.className = 'dtb-label';
      label.textContent = o.text;
      b.appendChild(label);
    }
    return b;
  }

  function sep(): HTMLElement {
    const s = doc.createElement('span');
    s.className = 'dtb-sep';
    s.setAttribute('aria-hidden', 'true');
    return s;
  }
}
