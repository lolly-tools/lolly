/**
 * Ports the Design tool's side columns (navigator, inspector) and top bar use to talk to
 * the free-canvas overlay and the tool view - plan 179, milestones M1 to M3.
 *
 * These are STRUCTURAL contracts: free-canvas.ts satisfies them from its existing
 * internals (the selection notifier behind `paintChrome`, `emitActiveArtboard`, the
 * frame thumbnail cloner), and the new modules depend only on this file, so they can be
 * built and jsdom-tested against fakes before the overlay grows the methods.
 *
 * Nothing here reaches the model directly. Every write goes through the injected
 * `commit`/`setField`, which is the tool view's undo-coalescing `runtime.setInput`
 * wrapper - never `setInputNoHistory`.
 */
import type { Box, BoxFieldConfig } from './free-canvas-math.ts';

/** An authoring line through a document-space point, rotated clockwise from horizontal. */
export interface DesignGuide {
  id: string;
  x: number;
  y: number;
  rotation: number;
  /** Empty uses the editor's guide colour. */
  color: string;
  snap: boolean;
}

export interface DesignGuidePort {
  selected(): DesignGuide | null;
  select(id: string | null): void;
  update(id: string, patch: Partial<Omit<DesignGuide, 'id'>>): void;
  remove(id: string): void;
  onChange(cb: () => void): () => void;
}

/** Selection as the overlay sees it: ids of the selected `boxes` rows. */
export interface SelectionPort {
  get(): string[];
  /** Replace the selection and repaint the overlay chrome. */
  set(ids: string[]): void;
  /** Fires once per selection change with the new ids; returns the unsubscribe. */
  onChange(cb: (ids: string[]) => void): () => void;
}

/** The artboard (frame) the editor is "on": the one containing the selection, else the primary. */
export interface ArtboardPort {
  /** The active frame id, or '' when the document has no frames. */
  active(): string;
  /** Pan/zoom the stage so the frame is framed (the `fc-focus-rect` path). */
  focus(id: string): void;
  /** Fires when the active frame changes; returns the unsubscribe. */
  onChange(cb: (id: string) => void): () => void;
}

/** The frame-primitive field map the Design manifest declares (`canvas.frameField` etc.). */
export interface FramePort {
  frameField: string;
  frameKind: string;
  orderField: string;
  clipChildrenField?: string;
  /** The row's human name field (`canvas.labelField`, 'name' for Design). */
  labelField?: string;
  /** `canvas.frameTransitionField` - the FRAME sub-field holding this slide's own
   *  transition into the next one (plans/179 M4, `slideTransition` for Design). Absent
   *  = the tool has no per-frame transition, so nothing derives one and no column
   *  offers to set one. */
  transitionField?: string;
}

/** Model access the columns are handed: read the rows, commit a whole new array (one undo step). */
export interface ModelPort {
  blockId: string;
  cfg: BoxFieldConfig;
  frame: FramePort | null;
  getBoxes(): Box[];
  commit(next: Box[]): void;
  /** Write one field across the given ids in a single commit. */
  setField(ids: string[], field: string, value: unknown): void;
  /** Subscribe to model changes (the runtime's subscribe); returns the unsubscribe. */
  subscribe(cb: () => void): () => void;
  /** Top-level (non-blocks) inputs, e.g. the doc-level `transition` select and `autoAdvance`. */
  getInput(id: string): unknown;
  setInput(id: string, value: unknown): void;
}

/** A frame thumbnail cloned from the live canvas page, scaled into maxW x maxH. */
export type FrameThumb = (frameBox: Box, maxW: number, maxH: number) => HTMLElement;

/** Verbs the navigator delegates to the overlay (it owns no model surgery beyond rename and reorder). */
export interface NavigatorActions {
  duplicateFrame(id: string): void;
  deleteFrame(id: string): void;
  addArtboardAfter(id: string): void;
  present?(fromFrameId: string): void;
  /** Reorder the z-stack of the active frame's children: ids in new paint order (first paints first). */
  reorderChildren?(frameId: string, orderedIds: string[]): void;
  /**
   * A new artboard drawn around loose boxes, which it then contains (plans/184 R15) -
   * how a timeline document with no artboards gets its first one from the navigator.
   * Absent, the navigator offers no such verb.
   */
  makeArtboard?(ids: string[]): void;
}

/** Verbs the inspector delegates to the overlay. */
export interface InspectorActions {
  pickImage(ids: string[]): void;
  openGradient(ids: string[]): void;
  /** Align / distribute / z-order verbs, by the overlay's existing op names. */
  arrange(op: string): void;
  /** Open the timeline panel on the given box's inspector group ('time' | 'animate' | 'keyframes'). */
  openTimeline(group: string, id: string): void;
}

/**
 * What one slide's narration is, as the columns paint it (plans/180 section 8).
 *
 * Four answers, and the fourth is the one that matters: `stale` says the notes were
 * edited after the voice was made, so re-generating is the author's decision rather
 * than something that happens on every keystroke.
 *
 *   none    - the slide has no speaker notes, so there is nothing to say
 *   pending - it has notes and no narration yet
 *   current - narrated, and the notes have not moved since
 *   stale   - narrated, but the notes changed after
 */
export type NarrationStatus = 'none' | 'pending' | 'current' | 'stale';

/**
 * Notes to voice, as the top bar, the navigator and the inspector reach it (plans/180
 * M-A). OPTIONAL on the ports: a host with no speech bridge passes nothing and no
 * column grows a control for it, rather than offering a button that cannot work.
 *
 * Both verbs are fire-and-forget - the overlay owns the consent sheet, the serial heavy
 * queue and the progress toast - and both are idempotent by the `narration:<frameId>`
 * group contract, so running one twice replaces a slide's clips instead of stacking them.
 */
export interface NarrationActions {
  /** Narrate every slide that carries speaker notes, in page order. */
  narrateAll(): void;
  /** Narrate (or re-narrate) one slide. */
  narrateFrame(frameId: string): void;
  /** This slide's status right now - a live read, never a snapshot. */
  status(frameId: string): NarrationStatus;
  /** Is there anything to narrate at all (any slide with notes), and is nothing already
   *  running? What greys the deck-wide row. Absent = the row is offered whenever the
   *  document has frames. */
  ready?(): boolean;
  /** Why the row is greyed, in one short sentence. A greyed control with no reason is
   *  what a sighted user reads as broken and a screen-reader user never meets at all. */
  reason?(): string;
}

/** Font choices the inspector's Text section offers: [value, label] pairs. */
export interface FontsPort {
  options(): Array<[string, string]>;
  weights(font: string): Array<[string, string]>;
}

/**
 * A rectangle in CLIENT pixels (getBoundingClientRect space, the same frame the stage-nav
 * fit and the `fc-query-rect` seam use), NOT canvas-native units: the consumers are the
 * zoom cluster and the focus/fit paths, which measure against the stage rect.
 */
export interface CanvasRect { x: number; y: number; w: number; h: number }

/**
 * Everything the tool view needs from the free-canvas overlay to mount the Design
 * chrome (plan 179 M1 to M3). `initFreeCanvas` returns it as `handle.design`; the
 * tool view hands the pieces to `mountDesignTopbar`, `initDesignNavigator` and
 * `initDesignInspector`. Every member is live: it reads the overlay's current state
 * when called, never a snapshot taken at mount.
 */
export interface DesignCanvasPorts {
  selection: SelectionPort;
  guides?: DesignGuidePort;
  artboard: ArtboardPort;
  thumb: FrameThumb;
  /** Model access bound to the overlay's own `getBoxes`/`commit`/`setField` (one undo step per call). */
  model: ModelPort;
  navigatorActions: NavigatorActions;
  inspectorActions: InspectorActions;
  /** Notes to voice (plans/180). Absent on a host with no speech bridge - see NarrationActions. */
  narrationActions?: NarrationActions;
  fonts: FontsPort;
  /** The manifest's `boxes` field definitions (select options for shape, blend, fit, align...). */
  fields: unknown[];
  /** The active frame id ('' without frames) and its rect in client pixels. */
  activeFrameId(): string;
  activeFrameRect(): CanvasRect | null;
  /** Union of every frame page in client pixels, or null without frames. */
  contentRect(): CanvasRect | null;
  /** The selection's bounding box in client pixels, or null when nothing is selected. */
  selectionRect(): CanvasRect | null;
  /** Open the Lolly mark popover anchored to the given element (the trimmed document menu). */
  openLollyMenu(anchor: HTMLElement): void;
  toggleTimeline(): void;
  isTimelineOpen(): boolean;
  /** The legacy Artboards filmstrip (the navigator's mobile skin host). */
  toggleFramesPanel(): void;
  isFramesPanelOpen(): boolean;
  /**
   * The one writer of `--stage-reserve-left` / `--stage-reserve-right`: the columns report
   * their widths here and the overlay adds the docked-rail allowance itself.
   */
  setColumnWidths(left: number, right: number): void;
  /**
   * Register the mounted inspector so the object bar's Text / More / Dims / Stroke buttons
   * reveal its sections instead of opening the one-slot panels; null restores the panels.
   */
  setInspector(inspector: { reveal(section: 'document' | 'artboard' | 'object' | 'text' | 'image' | 'motion' | 'present' | 'guide'): void } | null): void;
}

/** Chrome the tool view already owns and lends to the overlay's mark menu (theme, sounds, profile). */
export interface DesignChromeOpts {
  themeToggle?: HTMLElement;
  soundToggle?: HTMLElement;
  profileEl?: HTMLElement;
  /** Save to your library (the render pill's save), when the tool can save. */
  saveToLibrary?(): void;
}
