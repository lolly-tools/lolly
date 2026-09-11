// SPDX-License-Identifier: MPL-2.0
/**
 * The Design editor's INSPECTOR column - plan 179 M3, slice (c).
 *
 * A scrollable property column, shown in the app's one right sidebar (see LAYOUT
 * below), that replaces the
 * one-slot property panels (Text / More / Dims / Stroke / Frame state / CSS class /
 * Speaker notes / Morph match). Those panels shared a single slot, so opening one
 * closed the last, and every selection change tore the open one down: the editor
 * could show exactly one property of one box at a time. The column shows all of
 * them at once, gated by what the selection actually IS.
 *
 * WHAT IT OWNS, AND WHAT IT DOES NOT. Everything is injected through
 * `views/design-ports.ts`: the model (read the rows, write one field across the
 * selection in ONE commit), the selection, the active artboard, and the four verbs
 * that need the overlay's own code (`pickImage`, `openGradient`, `arrange`,
 * `openTimeline`). It imports nothing from `free-canvas.ts` or `tool.ts` - the row
 * builders it shares with the overlay live in `views/free-canvas-fields.ts` - so it
 * mounts and is tested on a bare jsdom stage against fakes.
 *
 * ONE COMMIT PER GESTURE. Every write is `model.setField(ids, field, value)`, which
 * is tool.ts's undo-coalescing `runtime.setInput` wrapper. `setInputNoHistory` is
 * never reachable from here, by construction: this module is not handed a runtime.
 * Text fields commit on `change` (at blur, not per keystroke), sliders on `change`
 * (pointer release / keyboard commit), and the number cells once per gesture of their
 * own (see `numField`) - so a drag is one undo step, not sixty.
 *
 * REPAINT DISCIPLINE. One `model.subscribe` handler, memoised on the selection ids
 * plus the WATCHED field values of the sections currently visible. An edit to a
 * field no visible section shows (a `notes` edit while a box is selected, the
 * timeline writing keyframes) leaves the DOM alone. A CLOSED column skips the work
 * entirely and repaints once on open. And a rebuild never runs while the user is
 * standing in something it would destroy - a caret in a text field, a number cell
 * being scrubbed, or an open colour popover (the picker emits on every slider `input`,
 * so rebuilding on its own echo would delete the popover mid-drag). Those rebuilds are
 * deferred and re-tried once the gesture settles. When a rebuild does land, the focused control
 * is re-found by its field identity and re-focused, because every non-text control
 * commits DURING the interaction: without that, one arrow key on a slider drops
 * focus to `<body>` and the second one scrolls the page.
 *
 * WRITES GO TO THE ROW THE CONTROL WAS BUILT FOR, not to `selection.get()` at event
 * time. A text field commits at BLUR, and its rebuild is deferred while the caret is
 * in it, so the row outlives the selection it was rendered from: reading the live
 * selection wrote speaker notes typed for one slide onto whatever the canvas had
 * selected by the time the caret left.
 *
 * LAYOUT: THIS PROPERTY MODULE OWNS NONE OF IT. The column is built DETACHED and positions
 * nothing. The host's `design-inspector-float.ts` controller either puts the same live
 * panel in the app's one right sidebar or gives it a persisted floating box, so this
 * root fills whatever berth it is given and `width()` is always 0 (the dock owns its width,
 * and a floating panel overlays rather than reserving the stage). The one
 * `--dock-w` inset nudges the view), and nothing here writes `--stage-reserve-*` or
 * dispatches `canvas-resize`. Before this, the column absolutely positioned itself over
 * the stage AND reserved 280px, which is how the editor ended up with two right-hand
 * columns side by side - this one inside the stage, the export dock beside it.
 *
 * Being in a slot implies being open: the panel follows `onDockChange`, while its
 * detachable controller keeps the floating case open explicitly. The header's close
 * button and the top bar therefore still share one `setOpen` answer.
 *
 * EVERY GROUP COLLAPSES (2026-09-03). Each group is a `<section>` with a real button
 * header carrying `aria-expanded`, including the five that used to run as one flat list
 * inside Object (Fill & Stroke, Appearance, Shadow, Perspective tilt, Arrange) - a
 * shadowed text box on a phone was otherwise a column of forty rows with no way to put
 * any of it away. What the user leaves open is remembered per device under
 * {@link SECTIONS_KEY}, and the sections that start shut open themselves for a selection
 * that has something in them (a shadow set, a tilt off zero), so a collapsed group never
 * hides a value the user can see on the canvas.
 *
 * NUMBERS ARE `numField` (components/num-field.ts). Every numeric value in the column -
 * geometry, size, radius, shadow offsets, tilt, durations - is the same control: drag its
 * label to scrub, arrow keys to step, type `+10` or `1920/2` into it. Sliders stay beside
 * opacity and corner radius, where a coarse sweep is the point, but the number is the
 * control that commits. One gesture is one `model.setField`, which is one undo step; the
 * slider mirrors the number and vice versa, and neither writes while the other is moving.
 *
 * ONE MOTION MODEL (2026-09-03, plans/179 M4). The Motion section's Appears control is
 * the single place a box says WHEN it arrives - with the slide, on a click, or at a
 * moment - and it writes the exclusive patch `lib/motion-model.ts` returns, so a box can
 * no longer carry a build step and a timeline start at once. Artboard gains the slide's
 * own transition to the next one (empty = follow the deck), and Object the two layer
 * flags. All three are drawn only where the MANIFEST declares the field (`declaredField`).
 *
 * MIXED IS A REAL STATE. Every cell in a paint group reads all the selected rows, and
 * shows "Mixed" rather than the first row's number when they disagree - because one
 * write goes to all of them, so a cell that shows 100 for a selection of 100 and 20
 * turns one arrow key into "set both to 99".
 */
import { t, tRaw } from '../i18n.ts';
import { escape } from '../utils.ts';
import { parseVoiceBlend, KOKORO_DEFAULT_VOICE } from '../../../../engine/src/speech-text.ts';
import { inspectDesignV1 } from '@lolly-tools/core';
import type { SpeechVoiceInfo } from '@lolly-tools/core/host-v1';
import { icon } from '../lib/icons.ts';
import type { IconName } from '../lib/icons.ts';
import { colorFieldHtml, wireColorField, resolveColorVar, colorVarLabel } from '../components/color-field.ts';
import type { ColorFieldValue } from '../components/color-field.ts';
import { numField } from '../components/num-field.ts';
import type { NumFieldHandle } from '../components/num-field.ts';
import {
  FIELD_GLYPH, TILT_RANGE, dimOf, iconRow, opt, posGridHtml, segHtml, segRow,
  shadowChoicesFrom, shapeChoicesFrom, wireSegs,
} from './free-canvas-fields.ts';
import type { ChoiceField } from './free-canvas-fields.ts';
import type { Box, BoxFieldConfig } from './free-canvas-math.ts';
import type {
  ArtboardPort, DesignGuide, DesignGuidePort, FramePort, InspectorActions, ModelPort, NarrationActions, NarrationStatus, SelectionPort,
} from './design-ports.ts';
import { isDocked, onDockChange } from '../lib/edge-dock.ts';
import {
  appearModeOf, appearSummary, NARRATION_LEAD_IN_MS, NARRATION_TAIL_MS, resetAppearMemory, setAppear,
} from '../lib/motion-model.ts';
import type { AppearIntent, AppearMode } from '../lib/motion-model.ts';
import { auditMountedDesign } from './design-mounted-audit.ts';
import type { MountedDesignAudit, MountedFontStyle } from './design-mounted-audit.ts';
import { mountedDesignFindingMessage } from './design-audit-copy.ts';

/** The dock slot this column lives in - the app's one right sidebar. */
const DOCK_ID = 'inspector';

/**
 * What the empty Voice field shows: the engine's own default voice today
 * (`KOKORO_DEFAULT_VOICE`, en-GB Lily). A PLACEHOLDER, never a written value - the
 * engine decides what an empty setting means - so the id is spelled here rather than
 * pulling the whole speech module into this column's chunk for one string.
 */

/**
 * The sections, in the order they are laid out. `reveal()` takes one of these.
 *
 * The first seven are the names the object bar and the context menu already call
 * `reveal()` with (see `views/design-ports.ts`'s `setInspector`), so they keep their
 * meaning; `fill`, `appearance`, `shadow`, `tilt` and `arrange` are the groups that used
 * to be sub-headings inside Object.
 */
export type InspectorSection =
  | 'document' | 'artboard' | 'object' | 'text' | 'image' | 'motion' | 'present'
  | 'fill' | 'appearance' | 'shadow' | 'tilt' | 'arrange' | 'guide';

/**
 * The arrange verbs the Object section offers, in the overlay's OWN op names
 * (`applyAlign` edges, `applyDistribute` axes, `applyZ` ops, plus group/ungroup) so
 * the host's `actions.arrange` is a switch, not a translation table. Exported so
 * the wiring slice can assert it covers every branch it routes.
 */
export const ARRANGE_OPS = [
  'left', 'hcentre', 'right', 'top', 'vcentre', 'bottom',
  'h', 'v',
  'front', 'forward', 'backward', 'back',
  'group', 'ungroup',
] as const;
export type ArrangeOp = (typeof ARRANGE_OPS)[number];

/** A font vocabulary the host resolves (brand faces + user fonts); absent = no Font row. */
export interface InspectorFonts {
  /** `[wire value, label]` pairs for the font select. */
  options(): Array<[string, string]>;
  /** `[wire value, label]` pairs for the weight select, given the current font. */
  weights(font: string): Array<[string, string]>;
}

export interface DesignInspectorOpts {
  /**
   * The tool stage. Kept because the host has it and hands it to every Design chrome
   * module; this column no longer appends itself to it or measures against it - the dock
   * column owns its placement (see the header).
   */
  stageEl?: HTMLElement;
  /** The live render canvas - the cascade that resolves a `var()` fill to a colour. */
  canvasEl: HTMLElement;
  model: ModelPort;
  selection: SelectionPort;
  guides?: DesignGuidePort;
  artboard: ArtboardPort;
  actions: InspectorActions;
  /**
   * Notes to voice (plans/180 section 8). Absent - a host with no speech bridge - and the
   * Present section keeps its notes textarea with no Narrate button under it, rather than
   * offering a button that cannot work.
  */
  narration?: NarrationActions;
  /** Live outcome gate. Unlike omitting `narration`, this may change while the
   * document is mounted when the user changes the workspace outcome. */
  narrationEnabled?(): boolean;
  /** The speech bridge's voice list, for the narration voice picker (Andy, 2026-09-03:
   *  "the voice should be a select like in the utility and Script audio"). Absent on a
   *  host with no speech bridge; the picker then holds only the current value. */
  voices?: () => Promise<SpeechVoiceInfo[]>;
  fonts?: InspectorFonts;
  /** Resolve a rendered run through the vector-export font registry. This is
   * async because user/discovered webfonts may need their bytes checked. */
  resolveFont?: (style: MountedFontStyle, text: string) => Promise<boolean>;
  /** The manifest's `boxes` field declarations - the source of every select's options. */
  fields?: unknown[];
  /** Open on mount (the host decides from viewport width + its device-local memory). */
  initiallyOpen?: boolean;
  onOpenChange?(open: boolean): void;
  /**
   * The header's close button was pressed. The host owns the dock slot, so it is the
   * host that takes the column back out of the sidebar and records the preference.
   */
  onClose?(): void;
  /**
   * Kept so the mount contract does not change, and always called with 0: the dock
   * column owns the width now, and reports it through its own `--dock-w`.
   */
  onWidthChange?(px: number): void;
}

export interface DesignInspectorHandle {
  el: HTMLElement;
  setOpen(b: boolean): void;
  isOpen(): boolean;
  /** Re-read live shell-only gates without waiting for a model mutation. */
  sync(): void;
  /** Always 0: the dock column reserves the space, this panel reserves nothing. */
  width(): number;
  reveal(section: InspectorSection): void;
  destroy(): void;
}

/** `model.cfg` as the overlay actually resolves it - every optional field name present. */
type Cfg = BoxFieldConfig & Record<string, string | undefined>;

/**
 * The three field names M4 added to the tool's `canvas` block. Both spellings the
 * overlay uses for the per-frame transition are accepted, so this column works whichever
 * one the port ends up carrying, and each falls back to the literal name the Design
 * manifest declares - the same rule the column already follows for `notes` and `cls`.
 * Nothing is drawn for a field the manifest does not declare (see `declaredField`).
 */
interface InspFrameCfg extends FramePort {
  hiddenField?: string;
  lockedField?: string;
  transitionField?: string;
  frameTransitionField?: string;
}

/**
 * The segmented control that writes the Appears mode. Not a model field - one press
 * rewrites FOUR of them through `setAppear` - so it carries a name of its own that
 * `wire` routes, and `write()` can never be handed it by accident.
 */
const APPEAR_SEG = 'lolly-appear';

/**
 * `rows` is EVERY selected box, not just `box`. A cell that reads one row and writes
 * the whole selection has to know whether the rest agree with it, or it shows the
 * first box's number as if it spoke for them all (see `agree`).
 */
type Gate =
  | { kind: 'guide'; ids: string[]; box: null; rows: Box[]; secs: InspectorSection[]; guide: DesignGuide }
  | { kind: 'empty'; ids: string[]; box: null; rows: Box[]; secs: InspectorSection[] }
  | { kind: 'frame' | 'object' | 'multi'; ids: string[]; box: Box; rows: Box[]; secs: InspectorSection[] };

/** Everything a number cell may say beyond its label, field and current value. */
interface NumCellOpts {
  name?: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  /** The `data-num` key of the slider this cell mirrors, when it has one. */
  pair?: string;
  /** Overrides the default write (used where the value is not one model field). */
  onCommit?(v: number): void;
  /**
   * Stored value = shown value x scale. A doc input kept in ms is shown in seconds with
   * `scale: 1000` - one time notation in the editor (plans/184 R7); `min`/`max` are in
   * the SHOWN unit.
   */
  scale?: number;
}

/** One number cell awaiting its slot: the markup goes in first, the control after. */
interface NumSpec { key: string; pair?: string; opts: Parameters<typeof numField>[0] }

const DOCUMENT_UNITS = ['px', 'mm', 'cm', 'in', 'pt'] as const;
type DocumentUnit = (typeof DOCUMENT_UNITS)[number];
const CSS_PX_PER_UNIT: Record<DocumentUnit, number> = { px: 1, mm: 96 / 25.4, cm: 96 / 2.54, in: 96, pt: 96 / 72 };

/**
 * The M4 field names, resolved per instance rather than off `cfg` - they live on the
 * frame port, and a manifest that does not declare one leaves it undefined.
 */
interface FlagFields { trans?: string; hidden?: string; locked?: string }

/** Which fields each section reads. The repaint memo hashes exactly these. */
const WATCHED: Record<InspectorSection, (c: Cfg, m: FlagFields) => Array<string | undefined>> = {
  document: () => [],
  guide: () => [],
  artboard: (c, m) => [c.labelField, c.wField, c.hField, c.fillField, c.gradField, c.strokeField, c.strokeWField, c.clipChildrenField, c.orderField, m.trans],
  object: (c, m) => [c.xField, c.yField, c.wField, c.hField, c.rotationField, 'cls', m.hidden, m.locked],
  fill: (c) => [c.fillField, c.gradField, c.strokeField, c.strokeWField],
  appearance: (c) => [c.opacityField, c.blendField, c.radiusField, c.shapeField],
  shadow: (c) => [c.shadowField, c.shadowColorField, c.shadowXField, c.shadowYField, c.shadowBlurField],
  tilt: (c) => [c.rxField, c.ryField],
  arrange: () => [],
  text: (c) => [c.textField, c.fontField, c.fontSizeField, c.weightField, c.lineHeightField, c.trackingField,
    c.ligaturesField, c.alternatesField, c.fitTextField, c.alignField, c.valignField, c.padField, c.textColorField],
  image: (c) => [c.imageField, c.fitField, c.imgPosField],
  // `build` and `lane` have no cfg key of their own (the manifest names them literally,
  // as `notes` and `cls` are named), and the Appears control is derived from all four of
  // build/start/dur/lane - so a build step written anywhere else has to move this memo.
  motion: (c) => [c.startField, c.durField, c.enterField, c.exitField, c.enterMsField, c.exitMsField, c.holdField, c.splitField, c.kfField, 'build', 'lane'],
  // `notes` is here rather than in Artboard: the Present section is where a slide's
  // speaker notes are edited (plans/180), and the narration status is read off them.
  present: () => ['build', 'presentAudio', 'matchOf', 'state', 'stackOf', 'notes'],
};

/**
 * Section titles + their header glyph (names from `lib/icons.ts`; none are added
 * there). The title is a THUNK holding a literal `t('…')`, for two reasons: the
 * extractor (`scripts/translate.ts`'s `T_CALL_RE`) only finds literal call sites,
 * so a bare string here would never reach a locale file; and the call runs at
 * render time, so a language switch repaints in the new language.
 */
const SECTION_META: Record<InspectorSection, { title: () => string; glyph: IconName }> = {
  document: { title: () => t('Document'), glyph: 'document' },
  guide: { title: () => t('Guide'), glyph: 'grid' },
  artboard: { title: () => t('Artboard'), glyph: 'crop' },
  object: { title: () => t('Object'), glyph: 'shapes' },
  fill: { title: () => t('Fill & Stroke'), glyph: 'palette' },
  appearance: { title: () => t('Appearance'), glyph: 'sliders' },
  shadow: { title: () => t('Shadow'), glyph: 'duplicate' },
  tilt: { title: () => t('Perspective tilt'), glyph: 'rotateCw' },
  arrange: { title: () => t('Arrange'), glyph: 'layers' },
  text: { title: () => t('Text'), glyph: 'font' },
  image: { title: () => t('Image'), glyph: 'image' },
  motion: { title: () => t('Motion'), glyph: 'animate' },
  present: { title: () => t('Present'), glyph: 'play' },
};

/** Where the collapse state is remembered, per device. */
export const SECTIONS_KEY = 'lolly-design-inspector-sections';

/**
 * Which sections stand open before the user has said anything.
 *
 * The ones that start shut are the ones most selections have nothing to say about
 * (no shadow, no tilt, nothing to align against) plus the two that are a door onto
 * another surface rather than a set of values (Motion opens the timeline, Present is
 * three per-slide fields). Every one of them opens on its own for a selection that
 * DOES carry a value - see `autoOpens` - so nothing is ever hidden that the canvas is
 * already showing.
 */
const DEFAULT_OPEN: Record<InspectorSection, boolean> = {
  document: true, guide: true, artboard: true, object: true, fill: true, appearance: true,
  shadow: false, tilt: false, arrange: false,
  text: true, image: true, motion: false, present: false,
};

/** The remembered state, section by section. Storage can be absent or refuse. */
function readSectionPrefs(): Partial<Record<InspectorSection, boolean>> {
  const out: Partial<Record<InspectorSection, boolean>> = {};
  try {
    const raw = localStorage.getItem(SECTIONS_KEY);
    if (!raw) return out;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return out;
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      // Own keys of the real section table only: a stored `__proto__` or `toString`
      // must never resolve through the prototype into a section name.
      if (typeof v === 'boolean' && Object.hasOwn(SECTION_META, k)) out[k as InspectorSection] = v;
    }
  } catch { /* no storage (private window, a host with none) - the defaults stand */ }
  return out;
}

function writeSectionPrefs(prefs: Partial<Record<InspectorSection, boolean>>): void {
  try { localStorage.setItem(SECTIONS_KEY, JSON.stringify(prefs)); } catch { /* nothing to remember with */ }
}

/** The blend modes offered when the manifest declares none of its own. */
const BLEND_FALLBACK = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn',
  'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];

/** Coerce a manifest/model boolean the way hooks.js `boolVal` does. */
function boolOf(v: unknown, dflt: boolean): boolean {
  if (v === true || v === false) return v;
  if (v == null || v === '') return dflt;
  const s = String(v).toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true;
  if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false;
  return dflt;
}

/** Finite number clamped to [lo,hi], else the default. */
function clampN(v: unknown, dflt: number, lo: number, hi: number): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (!Number.isFinite(n)) return dflt;
  return n < lo ? lo : (n > hi ? hi : n);
}

/**
 * Read one field off a box by a field NAME the manifest may not declare. Every
 * `cfg.*Field` is optional (a tool that has no shadow declares no `shadowField`),
 * so a bare `b[cfg.shadowField]` is both a type error and, at runtime, a lookup of
 * the literal key `undefined`. Absent name, absent value: the row is then not drawn.
 */
const fv = (b: Box, field: string | undefined): unknown => (field ? b[field] : undefined);

/** The picker hands back either a plain colour or `{ ref, value }` - the box stores the string. */
const unwrapColor = (v: ColorFieldValue): string => (v && typeof v === 'object' && 'value' in v ? v.value : String(v ?? ''));

export function initDesignInspector(opts: DesignInspectorOpts): DesignInspectorHandle {
  const { canvasEl, model, selection, artboard, actions, fonts, narration } = opts;
  let voiceList: SpeechVoiceInfo[] | null = null;   // the bridge's voices, fetched once per column
  let mountedAudit: MountedDesignAudit | null = null;
  let mountedAuditKey = '';
  let mountedAuditGeneration = 0;
  let mountedAuditRevision = 0;
  let boxesAuditKey = '';
  let waitingForCanvasPaint = false;
  const cfg = model.cfg as Cfg;
  const frame = model.frame as InspFrameCfg | null;
  const fieldDefs = (opts.fields || []) as ChoiceField[];
  // A new document: the numbers the Appears control remembers are keyed by row id, and
  // an id is only unique inside one document. See `resetAppearMemory`.
  resetAppearMemory();

  /**
   * A field name this column may draw a control for: one the MANIFEST declares.
   *
   * The three M4 fields are appended to `boxes.fields`, and `opts.fields` is that same
   * list - so asking it is how a control stays inert for a canvas tool that has no such
   * field, instead of writing a value nothing will ever read back.
   */
  const declaredField = (name: string | undefined): string | undefined =>
    (name && fieldDefs.some((f) => f?.id === name) ? name : undefined);

  /** The per-frame transition, the hidden flag and the locked flag, or undefined. */
  const F_TRANS = declaredField(frame?.transitionField || frame?.frameTransitionField || 'slideTransition');
  const F_HIDDEN = declaredField(frame?.hiddenField || 'hidden');
  const F_LOCKED = declaredField(frame?.lockedField || 'locked');
  /** The same three, in the shape {@link WATCHED} reads them. */
  const m4: FlagFields = { trans: F_TRANS, hidden: F_HIDDEN, locked: F_LOCKED };

  // ── the column ──────────────────────────────────────────────────────────────
  const el = document.createElement('aside');
  el.className = 'fc-insp';
  el.setAttribute('data-export-hide', '');
  el.setAttribute('data-live-hide', '');
  el.setAttribute('aria-label', t('Inspector'));
  // Built with createElement, not innerHTML: the column has exactly ONE raw-HTML
  // sink (the section render below), and a scaffold with no interpolation in it is
  // not worth a second entry in the R10 inventory.
  // The column's own head: what this is, and the way OUT of it. Without a close control
  // the column could only ever be opened - the object bar's Text / More / Stroke / dims
  // buttons `reveal()` it and nothing dismissed it - so a wide screen lost the sidebar's
  // width for good and a phone got a sheet over most of the screen with no way back.
  // Closing means UNDOCKING, which is the host's call: `onClose` hands it over.
  const headBar = document.createElement('div');
  headBar.className = 'fc-insp-headbar';
  const colTitle = document.createElement('h2');
  colTitle.className = 'fc-insp-coltitle';
  colTitle.textContent = t('Inspector');
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'fc-insp-close';
  closeBtn.setAttribute('data-act-col', 'close');
  closeBtn.setAttribute('aria-label', t('Hide inspector'));
  closeBtn.title = t('Hide inspector');
  closeBtn.innerHTML = icon('close');
  closeBtn.addEventListener('click', () => { setOpen(false); opts.onClose?.(); });
  headBar.append(colTitle, closeBtn);
  el.appendChild(headBar);

  const scroll = document.createElement('div');
  scroll.className = 'fc-insp-scroll';
  scroll.tabIndex = -1;
  el.appendChild(scroll);
  // DETACHED on purpose: the host docks this element into the one right sidebar. Nothing
  // is appended to the stage, so the editor cannot grow a second right-hand column.

  let open = opts.initiallyOpen !== false;
  /**
   * What the USER has said about each section, and nothing else. An absent entry
   * means "not asked", which is where {@link DEFAULT_OPEN} and the per-selection
   * auto-open take over; an explicit `false` beats both, because a section the user
   * closed on purpose must stay closed.
   */
  const sectionPrefs = readSectionPrefs();
  /** The number cells built for the CURRENT markup, and the sliders they mirror. */
  let numSpecs: NumSpec[] = [];
  let numMounted: NumFieldHandle[] = [];
  const numByPair = new Map<string, NumFieldHandle>();
  let lastSig: string | null = null;   // null, so the very first sync always paints
  let lastWidth = -1;
  let pendingRebuild = false;
  let destroyed = false;
  /**
   * The ids the CURRENTLY MOUNTED rows were built for. Every write targets these,
   * never `selection.get()`: see the header - a deferred rebuild keeps a row alive
   * across a selection change, and a commit at blur must land where the user typed.
   */
  let renderedIds: string[] = [];
  let renderedGuideId: string | null = null;

  // ── model reads ─────────────────────────────────────────────────────────────

  const idOf = (b: Box, i: number): string => String(fv(b, cfg.idField) ?? i);
  const kindOf = (b: Box | null): string => String(b?.[cfg.kindField ?? 'kind'] ?? '');

  function boxesById(ids: string[]): Box[] {
    if (!ids.length) return [];
    const wanted = new Set(ids);
    return model.getBoxes().filter((b, i) => wanted.has(idOf(b, i)));
  }

  /**
   * The paint groups a box offers, in order. Declared by the manifest, not assumed:
   * a tool with no `shadowField` gets no Shadow header to open onto nothing.
   */
  function paintSecs(one: boolean): InspectorSection[] {
    const secs: InspectorSection[] = [];
    if (cfg.fillField || cfg.strokeField || cfg.strokeWField) secs.push('fill');
    if (cfg.opacityField || cfg.blendField || cfg.radiusField || cfg.shapeField) secs.push('appearance');
    if (cfg.shadowField && shadowChoicesFrom(fieldDefs, cfg.shadowField).length) secs.push('shadow');
    if (one && (cfg.rxField || cfg.ryField)) secs.push('tilt');
    secs.push('arrange');
    return secs;
  }

  /** What the selection IS, and therefore which sections may show. */
  function gate(): Gate {
    const guide = opts.guides?.selected();
    if (guide) return { kind: 'guide', ids: [], box: null, rows: [], secs: ['guide'], guide };
    const ids = selection.get().filter((s) => s != null && s !== '');
    if (!ids.length) return { kind: 'empty', ids: [], box: null, rows: [], secs: ['document'] };
    const rows = boxesById(ids);
    const box = rows[0] ?? {};
    // Position and size read the FIRST selected box and write the whole selection, so on
    // a multi-selection they would stamp one box's x onto every other: no Object section
    // for more than one box, only the paint groups that mean the same thing across them.
    // The groups that DO stay read every row, so a value the rows disagree about shows
    // as mixed instead of as the first box's.
    if (ids.length > 1) return { kind: 'multi', ids, box, rows, secs: paintSecs(false) };
    if (frame && kindOf(box) === frame.frameKind) return { kind: 'frame', ids, box, rows, secs: ['artboard', 'present', 'motion'] };
    const secs: InspectorSection[] = ['object', ...paintSecs(true)];
    const hasText = kindOf(box) === 'text' || (!!cfg.textField && String(box[cfg.textField] ?? '') !== '');
    if (hasText) secs.push('text');
    if (cfg.imageField && box[cfg.imageField]) secs.push('image');
    secs.push('motion');
    // …and Present LAST, for the three per-box fields only a box can carry (see
    // presentBody). One box at a time: `build` and `matchOf` are per-object answers,
    // and stamping one box's build step across a multi-selection is not an edit anyone
    // asked for. Collapsed away by the section head for a document that never presents.
    secs.push('present');
    return { kind: 'object', ids, box, rows, secs };
  }

  /**
   * What every selected row says for one number, or 'mixed' when they disagree.
   *
   * Every cell in this column writes its field across the WHOLE selection in one
   * commit, so a cell showing the first row's number is a cell that stamps that number
   * on the rest at the first arrow key: two boxes at 100% and 20% opacity showed 100,
   * and one ArrowDown set both to 99. `numField` has a mixed state for exactly this -
   * an empty box with a "Mixed" placeholder, and a scrub that counts from zero - and
   * this is what puts it into it. The comparison is on the DISPLAYED number, so two
   * rows that would draw the same cell are not called mixed over a stored '20' and a
   * stored 20.
   */
  function agree(rows: Box[], read: (b: Box) => number): number | 'mixed' {
    const first = read(rows[0] ?? {});
    return rows.every((r) => read(r) === first) ? first : 'mixed';
  }

  /** True when the selected rows hold different values for one field (colours, choices). */
  function differs(rows: Box[], field: string | undefined): boolean {
    if (!field || rows.length < 2) return false;
    const first = String(fv(rows[0]!, field) ?? '');
    return rows.some((r) => String(fv(r, field) ?? '') !== first);
  }

  /**
   * A section that starts shut, but whose selection has something IN it.
   *
   * A box with a drop shadow set, or a tilt off zero, is painted that way on the
   * canvas: showing a closed "Shadow" header over it would hide the only controls
   * that explain what the user is looking at. Checked per selection, so the group
   * closes again on the next box that has none.
   */
  function autoOpens(sec: InspectorSection, b: Box | null): boolean {
    if (!b) return false;
    const n = (f: string | undefined): number => {
      const v = parseFloat(String(fv(b, f) ?? 0));
      return Number.isFinite(v) ? v : 0;
    };
    if (sec === 'shadow') {
      const cur = String(fv(b, cfg.shadowField) ?? 'none');
      return (cur !== '' && cur !== 'none') || n(cfg.shadowXField) !== 0 || n(cfg.shadowYField) !== 0;
    }
    if (sec === 'tilt') return n(cfg.rxField) !== 0 || n(cfg.ryField) !== 0;
    // A box that appears on a click, or at a moment on the timeline, is doing something
    // the canvas cannot show standing still - so the section that says WHEN opens itself
    // rather than leaving a "Motion" header over the only explanation there is.
    if (sec === 'motion') return appearModeOf(b) !== 'slide';
    // A slide with speaker notes opens Present on its own: the notes live in that section
    // now (plans/180), and a closed header over the words the author already wrote would
    // hide them behind a click on every selection.
    if (sec === 'present') return String(b['notes'] ?? '').trim() !== '';
    return false;
  }

  /** Is this section expanded right now: what the user said, else the default, else its values. */
  function isExpanded(sec: InspectorSection, g: Gate): boolean {
    const said = sectionPrefs[sec];
    if (typeof said === 'boolean') return said;
    return DEFAULT_OPEN[sec] || autoOpens(sec, g.box);
  }

  /** The element whose cascade resolves a `var()` colour - the tool's own canvas. */
  const colorScope = (): Element => (typeof document !== 'undefined' ? document.getElementById('tool-canvas') : null) ?? canvasEl;

  /**
   * A colour field seeded with the RESOLVED colour (plan 179 A2). A stored
   * `var(--brand-surface, #fff)` seeded the old swatch black; resolving it through the
   * canvas's computed style shows the colour the box is actually painted, and carries
   * the token's own name onto the trigger. The MODEL is untouched - the `var()` stays
   * in the box until the user picks something else.
   */
  function colorField(id: string, raw: unknown, label = '', mixed = false): string {
    const s = raw == null ? '' : String(raw);
    // Rows that disagree get the first one's swatch with the NAME "Mixed" on it, rather
    // than a name that claims the whole selection is that colour. The swatch itself is
    // still a real colour because the trigger has to paint something, and picking any
    // colour in the popover writes it to every selected row - which is what a swatch on
    // a multi-selection is for.
    if (mixed) return colorFieldHtml(id, resolveColorVar(s, colorScope()), { float: true, name: t('Mixed'), label });
    // `label` is the ROW's own label, handed to the trigger as the first half of its
    // accessible name. The column can show four colour fields on one box (Fill, Stroke,
    // shadow Colour, Text colour) and its rows are `<div><span>` pairs, which associate
    // nothing - so without this every one of them announced the same "Colour: #000000".
    return colorFieldHtml(id, resolveColorVar(s, colorScope()), { float: true, name: colorVarLabel(s), label });
  }

  /** The manifest's own options for a field, `[value, label]`, already translated. */
  function optionsOf(fieldId: string | undefined): Array<[string, string]> {
    if (!fieldId) return [];
    const def = fieldDefs.find((f) => f?.id === fieldId);
    return (def?.options || []).map((o) => [String(o.value ?? ''), t(String(o.label || o.value || ''))] as [string, string]);
  }

  /** The canvas's own native size, for the Document readout. */
  function canvasSize(): { w: number; h: number } {
    const sw = parseFloat(canvasEl.style.width) || 0;
    const sh = parseFloat(canvasEl.style.height) || 0;
    if (sw > 0 && sh > 0) return { w: Math.round(sw), h: Math.round(sh) };
    return { w: Math.round(canvasEl.offsetWidth || 0), h: Math.round(canvasEl.offsetHeight || 0) };
  }

  // ── row builders (this column's own; the shared ones come from free-canvas-fields) ──

  const textRow = (label: string, field: string, value: unknown, placeholder = ''): string =>
    `<label class="fc-row fc-insp-text"><span>${label}</span>`
    + `<input type="text" class="field-input" data-fld="${escape(field)}" data-kind="str" spellcheck="false"`
    + ` autocomplete="off" value="${escape(String(value ?? ''))}" placeholder="${escape(placeholder)}"></label>`;

  /**
   * A number cell: a placeholder in the section markup now, a real `numField`
   * mounted into it as soon as the markup is written (see `mountNums`).
   *
   * The control is built rather than serialised because it owns a pointer gesture,
   * a key coalesce and an expression parser - none of which survives being turned
   * into an attribute string. The slot keeps the ONE raw-HTML write this column has.
   */
  function numCell(label: string, field: string | undefined, value: number | 'mixed', o: NumCellOpts = {}): string {
    // Keyed by the field it writes, so the focus restore after a rebuild finds the
    // same cell again; a cell with no field of its own falls back to its position, and
    // a repeat of either takes an index so two cells can never claim one slot.
    const want = field ? `f:${field}` : `k:${label || numSpecs.length}`;
    const key = numSpecs.some((s) => s.key === want) ? `${want}#${numSpecs.length}` : want;
    numSpecs.push({
      key,
      pair: o.pair,
      opts: {
        id: key,
        label,
        value,
        name: o.name || label,
        unit: o.unit,
        min: o.min,
        max: o.max,
        step: o.step,
        precision: o.precision,
        // Geometry is stored in CSS pixels even when a Design document is authored in
        // millimetres/inches/etc. `dimCell` supplies `scale` for that display boundary;
        // duration rows provide their own writer, so their millisecond scale stays intact.
        onCommit: o.onCommit ?? ((v: number) => write(field, o.scale ? v * o.scale : v)),
        onPreview: o.pair ? (v: number) => mirrorRange(o.pair!, v) : undefined,
      },
    });
    return `<span class="num-slot" data-num-slot="${escape(key)}"></span>`;
  }

  /** The persisted Design unit; absent only for a legacy/non-Design host. */
  const documentUnit = (): DocumentUnit => {
    const value = String(model.getInput('documentUnit') ?? 'px');
    return (DOCUMENT_UNITS as readonly string[]).includes(value) ? value as DocumentUnit : 'px';
  };

  /**
   * One labelled geometry cell in the DOCUMENT's unit. Geometry remains stored in CSS px,
   * but all Inspector X/Y/W/H fields speak the same unit as the size panel and export
   * sheet; the scale on commit is the one conversion boundary. Fractional px survive.
   */
  const dimCell = (label: string, field: string | undefined, value: number | 'mixed', o: NumCellOpts = {}): string => {
    const unit = documentUnit();
    const scale = CSS_PX_PER_UNIT[unit];
    const shown = value === 'mixed' ? value : Math.round(value / scale * 1000) / 1000;
    const step = unit === 'px' ? 1 : unit === 'in' ? 0.01 : unit === 'pt' ? 0.5 : 0.1;
    return numCell(label, field, shown, { unit, step, precision: unit === 'px' ? 1 : 3, scale, ...o });
  };

  /** A plain labelled row whose whole control is one number. `tip` is a helptip on the
   *  label - what this number does on the surface the person is looking at. */
  const numRow = (label: string, field: string, value: number, o: NumCellOpts = {}, tip?: string): string =>
    `<div class="fc-row"><span${tip ? ` data-tip="${escape(tip)}"` : ''}>${label}</span>${numCell('', field, value, { name: label, ...o })}</div>`;
  /** Milliseconds to the seconds the editor shows, one decimal. */
  const msToS = (ms: number): number => Math.round(ms / 100) / 10;

  /**
   * A row whose control is not one labelled input. `iconRow` wraps its contents in a
   * `<label>`, which may only name a single control - a slider PLUS its number needs
   * a plain row and an explicit name on each. Same markup as `segRow`, under the name
   * that says what it is used for here.
   */
  const ctrlRow = segRow;

  /**
   * A slider and its number, side by side. The slider is the coarse sweep; the number
   * is the control that commits, and each mirrors the other while it moves. Only the
   * two values with a natural range (opacity, corner radius) get one.
   *
   * A thumb can only stand in one place, so on a mixed selection it stands at the first
   * row's value and says "Mixed" to a screen reader. That is honest enough for a control
   * whose whole gesture is "put them all here": a slider is dragged deliberately, unlike
   * the number cell, where one arrow key used to rewrite every other row in silence.
   */
  const sliderRow = (glyph: string, label: string, key: string, field: string | undefined,
    value: number | 'mixed', at: number, min: number, max: number, o: NumCellOpts = {}): string =>
    ctrlRow(glyph, label,
      `<input type="range" class="field-range" data-fld="${escape(field ?? '')}" data-kind="num" data-num="${escape(key)}"`
      + ` min="${min}" max="${max}" value="${at}" aria-label="${escape(label)}"`
      + (value === 'mixed' ? ` aria-valuetext="${escape(t('Mixed'))}"` : '') + '>'
      + numCell('', field, value, { name: label, min, max, pair: key, ...o }));

  const toggleRow = (label: string, field: string, on: boolean): string =>
    `<label class="fc-row fc-row-toggle field-toggle"><span>${label}</span>`
    + `<input type="checkbox" class="field-check" data-fld="${escape(field)}" data-kind="bool"${on ? ' checked' : ''}></label>`;

  const selectRow = (label: string, field: string, choices: Array<[string, string]>, cur: unknown): string =>
    `<label class="fc-row"><span>${label}</span>`
    + `<select class="field-select field-select--sm" data-fld="${escape(field)}" data-kind="str">`
    + choices.map(([v, l]) => opt(v, l, cur)).join('') + '</select></label>';

  const colorRow = (label: string, id: string, raw: unknown, extra = '', mixed = false): string =>
    `<div class="fc-row"><span>${label}</span><span class="fc-cfield">${colorField(id, raw, label, mixed)}</span>${extra}</div>`;

  const readRow = (label: string, value: string): string =>
    `<div class="fc-row fc-insp-read"><span>${label}</span><b>${escape(value)}</b></div>`;

  const areaRow = (label: string, field: string, value: unknown, placeholder = ''): string =>
    `<label class="fc-insp-area"><span>${label}</span>`
    + `<textarea class="field-input" rows="4" data-fld="${escape(field)}" data-kind="str"`
    + ` placeholder="${escape(placeholder)}">${escape(String(value ?? ''))}</textarea></label>`;

  const doorBtn = (label: string, act: string, glyph: IconName): string =>
    `<div class="fc-row fc-insp-door"><button type="button" class="fc-cbtn" data-act="${escape(act)}">${icon(glyph)}<span>${label}</span></button></div>`;

  const chip = (label: string, value: string): string =>
    `<span class="fc-insp-chip"><i>${label}</i>${escape(value)}</span>`;

  const docToggleRow = (label: string, input: string): string =>
    `<label class="fc-row fc-row-toggle field-toggle"><span>${label}</span>`
    + `<input type="checkbox" class="field-check" data-doc="${escape(input)}" data-kind="bool"`
    + `${boolOf(model.getInput(input), false) ? ' checked' : ''}></label>`;

  const docSelectRow = (label: string, input: string, options: ReadonlyArray<[string, string]>): string => {
    const cur = String(model.getInput(input) ?? '');
    return `<label class="fc-row"><span>${label}</span><select class="field-select" data-doc="${escape(input)}">`
      + options.map(([value, text]) => `<option value="${escape(value)}"${value === cur ? ' selected' : ''}>${escape(text)}</option>`).join('')
      + '</select></label>';
  };

  /**
   * A document setting whose control is one number cell.
   *
   * The input id is handed to `numCell` as its key - so the cell is findable and its
   * focus survives a rebuild, exactly like a box field's - but the commit is REPLACED:
   * `onCommit` writes the top-level input and the default box write is never reached.
   */
  const docNumRow = (label: string, input: string, dflt: number, o: NumCellOpts = {}): string => {
    const min = o.min ?? 0, max = o.max ?? 60000;
    const scale = o.scale && o.scale > 0 ? o.scale : 1;
    const cur = clampN(model.getInput(input), dflt, min * scale, max * scale) / scale;
    const q = 10 ** (o.precision ?? 0);
    return `<div class="fc-row"><span>${label}</span>`
      + numCell('', input, Math.round(cur * q) / q, {
        name: label, ...o, min, max, onCommit: (v: number) => model.setInput(input, Math.round(v * scale * 1e6) / 1e6),
      })
      + '</div>';
  };

  /**
   * The narration voice as PICKERS (Andy, 2026-09-03: "like the utility and the Script
   * audio dialog"), not the text field plan 180 first shipped: a voice, an optional
   * second voice to blend with, and that voice's weight, composed into the one
   * `narrationVoice` string the engine reads (`a+b:w`, plans/181 section 4). The
   * options arrive from the speech bridge once the column is built (`fillVoiceOptions`);
   * until then each picker holds only the value the document has.
   */
  function docVoiceRows(): string {
    const cur = String(model.getInput('narrationVoice') ?? '').trim();
    const parts = parseVoiceBlend(cur || KOKORO_DEFAULT_VOICE);
    const main = parts[0]?.id || KOKORO_DEFAULT_VOICE;
    const other = parts[1]?.id || '';
    const weight = parts[1] ? Math.round(parts[1].w * 100) : 30;
    const opt = (id: string): string => `<option value="${escape(id)}" selected>${escape(voiceNameOf(id))}</option>`;
    return `<div class="fc-row"><span>${t('Voice')}</span><select class="field-select" data-doc-voice="main" aria-label="${escape(t('Voice'))}">${opt(main)}</select></div>`
      + `<div class="fc-row"><span>${t('Blend with')}</span><select class="field-select" data-doc-voice="blend" aria-label="${escape(t('Blend with'))}">`
      + `<option value=""${other ? '' : ' selected'}>${escape(t('None'))}</option>${other ? opt(other) : ''}</select></div>`
      + (other
        ? `<label class="fc-row fc-insp-text"><span>${t('Second voice weight')}</span><input type="number" class="field-input" data-doc-voice="weight" min="5" max="95" step="5" value="${weight}" aria-label="${escape(t('Second voice weight'))}"></label>`
        : '');
  }

  function voiceNameOf(id: string): string {
    return voiceList?.find((v) => v.id === id)?.name || id;
  }

  /** Fill the voice pickers from the bridge's list, grouped by language, keeping the
   *  value each holds. The list is fetched once per column and reused on rebuilds. */
  async function fillVoiceOptions(sels: NodeListOf<HTMLSelectElement>): Promise<void> {
    if (!opts.voices) return;
    if (!voiceList) {
      try { voiceList = await opts.voices(); } catch { voiceList = []; }
    }
    const list = voiceList;
    if (!list.length) return;
    for (const sel of sels) {
      if (!sel.isConnected) continue;
      const keep = sel.value;
      const blend = sel.dataset.docVoice === 'blend';
      const groups = new Map<string, SpeechVoiceInfo[]>();
      for (const v of list) { const k = v.lang || ''; (groups.get(k) ?? groups.set(k, []).get(k)!).push(v); }
      // Built with DOM calls, not markup: the names come from the bridge and never need
      // to be a raw-HTML sink (primitive-guards R10).
      const doc = sel.ownerDocument;
      const option = (value: string, label: string): HTMLOptionElement => {
        const o = doc.createElement('option');
        o.value = value;
        o.textContent = label;
        return o;
      };
      sel.replaceChildren();
      if (blend) sel.appendChild(option('', t('None')));
      for (const [lang, vs] of groups) {
        const parent: HTMLElement = lang ? doc.createElement('optgroup') : sel;
        if (lang) (parent as HTMLOptGroupElement).label = lang;
        for (const v of vs) parent.appendChild(option(v.id, v.name));
        if (lang) sel.appendChild(parent);
      }
      if (keep && !list.some((v) => v.id === keep)) sel.appendChild(option(keep, keep));
      sel.value = keep;
    }
  }

  // ── sections ────────────────────────────────────────────────────────────────

  /** Renderer-neutral checks shared with MCP plus the last settled browser-layout
   * audit. The latter is invalidated by a boxes change and only accepted again after
   * the canvas announces its corresponding paint. */
  function designHealthHtml(size: { w: number; h: number }): string {
    const report = inspectDesignV1(model.getBoxes(), { width: size.w, height: size.h });
    const errors = report.findings.filter((finding) => finding.severity === 'error');
    const warnings = [
      ...report.findings.filter((finding) => finding.severity === 'warn'),
      ...(mountedAudit?.findings.filter((finding) => finding.severity === 'warn') ?? []),
    ];
    const manual = mountedAudit?.findings.filter((finding) => finding.severity === 'info') ?? [];
    const review = [...errors, ...warnings, ...manual];
    const knowCount = warnings.length + manual.length;
    const tone = errors.length ? 'error' : (warnings.length || manual.length) ? 'warn' : 'clean';
    const verdict = errors.length
      ? t('{fix} to fix, {know} to know', { fix: errors.length, know: knowCount })
      : knowCount === 1
        ? t('One thing to know')
        : knowCount > 1
          ? t('{n} things to know', { n: knowCount })
          : '';
    const artboardLabel = report.summary.artboards === 1 ? t('Artboard') : t('Artboards');
    const layerLabel = report.summary.layers === 1 ? t('Layer') : t('Layers');
    const facts = `${report.summary.artboards} ${artboardLabel} · ${report.summary.layers} ${layerLabel}`;
    const items = review.length
      ? `<ul>${review.slice(0, 3).map((finding) => `<li>${escape(
          'evidence' in finding ? mountedDesignFindingMessage(finding) : finding.message
        )}</li>`).join('')}</ul>`
      : '';
    return `<div class="fc-design-check" data-design-check="${tone}" role="status">`
      + `<span class="fc-design-check-icon">${icon(tone === 'error' ? 'alert' : 'checklist')}</span>`
      + `<div class="fc-design-check-copy"><strong>${escape(t('Before you export'))}</strong>`
      + `<span>${escape([facts, verdict].filter(Boolean).join(' · '))}</span>${items}</div></div>`;
  }

  function currentBoxesAuditKey(): string {
    try { return JSON.stringify(model.getBoxes()); } catch { return String(model.getBoxes().length); }
  }

  /** Run only against a settled canvas. A model echo arrives before tool.ts's rAF
   * paint, so a boxes change sets `waitingForCanvasPaint`; the explicit paint event
   * below is what releases the audit. */
  function scheduleMountedAudit(force = false): void {
    if (!open || waitingForCanvasPaint || destroyed) return;
    const key = `${boxesAuditKey}|${mountedAuditRevision}`;
    if (!force && key === mountedAuditKey) return;
    mountedAuditKey = key;
    const generation = ++mountedAuditGeneration;
    const size = canvasSize();
    const report = inspectDesignV1(model.getBoxes(), { width: size.w, height: size.h });
    void (async () => {
      try { await document.fonts?.ready; } catch { /* the mounted layout still answers */ }
      const result = await auditMountedDesign(canvasEl, report, { resolveFont: opts.resolveFont });
      if (destroyed || generation !== mountedAuditGeneration || boxesAuditKey !== currentBoxesAuditKey()) return;
      mountedAudit = result;
      // Mounted findings are deliberately outside `signature()` (which hashes authored
      // state). Force the one repaint that publishes this asynchronous browser answer.
      sync(true);
    })();
  }

  function documentBody(): string {
    const size = canvasSize();
    const unit = documentUnit();
    const scale = CSS_PX_PER_UNIT[unit];
    const fmt = (n: number): string => String(Math.round(n / scale * 1000) / 1000);
    return designHealthHtml(size)
      + readRow(t('Canvas size'), `${fmt(size.w)} x ${fmt(size.h)} ${unit}`)
      + docSelectRow(t('Document unit'), 'documentUnit', DOCUMENT_UNITS.map((u) => [u, u]))
      + docNumRow(t('Document DPI'), 'documentDpi', 300, {
        min: 36, max: 2400, step: 1, precision: 0, unit: 'dpi',
        onCommit: (dpi) => {
          const next = Math.round(dpi);
          model.setInput('documentDpi', next);
          canvasEl.dispatchEvent(new CustomEvent('fc-document-dpi', { detail: next }));
        },
      })
      + `<div class="fc-row"><span>${t('Background')}</span><span class="fc-cfield">${colorField('fc-insp-bg', model.getInput('background'), t('Background'))}</span></div>`
      + narrationDocRows()
      + `<p class="fc-insp-hint">${t('Select something to edit its properties.')}</p>`;
  }

  /**
   * The narration settings the whole DOCUMENT shares (plans/180 section 8): the voice
   * every slide is spoken in, how fast, and the two silences around it.
   *
   * Only where narration exists, because these four numbers describe a job this host
   * cannot run without a speech bridge. The voice is a TEXT field rather than a picker
   * of the 28 curated voices: plan 181 makes a blend (`af_heart+bf_emma`) a legal
   * setting and no select can express one. English only is the honest state of the
   * shipped G2P, and the hint says so rather than letting a French deck be read in an
   * English accent without warning.
   *
   * Lead-in and tail are the document-level settings plan 180 section 3 asks for, with
   * its own defaults (T1: 400 ms and 600 ms). They are numbers here and the same numbers
   * in `narrationDwellMs`, so what the presenter waits and what the video renders agree.
   */
  function narrationDocRows(): string {
    if (!narration || opts.narrationEnabled?.() === false) return '';
    return `<p class="fc-insp-hint">${t('Narration')}</p>`
      + docVoiceRows()
      + `<p class="fc-insp-hint">${t('English voices only.')}</p>`
      + docNumRow(t('Speed'), 'narrationSpeed', 1, { min: 0.5, max: 2, step: 0.05, precision: 2 })
      // The ranges are the MANIFEST's own (community/design/tool.json), so this column
      // cannot offer a number the runtime would refuse.
      + docNumRow(t('Lead-in'), 'narrationLeadInMs', NARRATION_LEAD_IN_MS, { min: 0, max: 5, step: 0.05, precision: 2, unit: 's', scale: 1000 })
      + docNumRow(t('Tail'), 'narrationTailMs', NARRATION_TAIL_MS, { min: 0, max: 5, step: 0.05, precision: 2, unit: 's', scale: 1000 })
      // Captions are ordinary boxes on the canvas, so a narrated deck would show them at
      // the podium too. Off by default: a live presenter is not a video (plans/180 s4).
      + docToggleRow(t('Show captions when presenting'), 'showCaptionsWhenPresenting');
  }

  function artboardBody(b: Box): string {
    const w = Math.max(1, dimOf(b, cfg.wField, 1)), h = Math.max(1, dimOf(b, cfg.hField, 1));
    const sw = Math.max(0, Math.round(clampN(fv(b, cfg.strokeWField), 0, 0, 400)));
    const clipF = frame?.clipChildrenField;
    const orderF = frame?.orderField;
    const labelF = frame?.labelField || cfg.labelField || 'name';
    return (labelF ? textRow(t('Name'), labelF, b[labelF], t('Artboard')) : '')
      + `<div class="fc-dims-row"><span class="fc-dims-ic" data-tip="${escape(t('Size'))}">${icon('resize')}</span>`
      + `${dimCell(t('W'), cfg.wField, w, { min: 1, max: 100000, name: t('Width') })}`
      + `${dimCell(t('H'), cfg.hField, h, { min: 1, max: 100000, name: t('Height') })}</div>`
      + (cfg.fillField
        ? colorRow(t('Fill'), 'fc-insp-fill', fv(b, cfg.fillField),
          `<button type="button" class="fc-cbtn fc-insp-mini" data-act="gradient">${t('Gradient')}</button>`)
        : '')
      + (cfg.strokeField ? colorRow(t('Stroke'), 'fc-insp-stroke', fv(b, cfg.strokeField)) : '')
      + (cfg.strokeWField ? ctrlRow(FIELD_GLYPH.strokeIc, t('Stroke width'), numCell('', cfg.strokeWField, sw, { name: t('Stroke width'), min: 0, max: 400, unit: 'px' })) : '')
      + (clipF ? toggleRow(t('Clip children'), clipF, boolOf(b[clipF], true)) : '')
      + transitionRows(b)
      // Speaker notes moved to the Present section (plans/180), beside the button that
      // turns them into a voice. Nothing here writes `notes` any more.
      + (orderF ? readRow(t('Order'), String(b[orderF] ?? '')) : '');
  }

  /**
   * How THIS slide changes into the next one, and the way back out of an override.
   *
   * The options are the manifest's own (empty = follow the deck, through to
   * `custom`), so the list here and the wire values the players read cannot drift.
   * `custom` is the one value no picker can produce - the timeline writes it when a
   * frame's enter/exit are edited by hand - so the row that clears it only appears
   * once it is set, and writing '' is what hands the slide back to the deck.
   */
  function transitionRows(b: Box): string {
    if (!F_TRANS) return '';
    const choices = optionsOf(F_TRANS);
    if (!choices.length) return '';
    const cur = String(fv(b, F_TRANS) ?? '');
    return selectRow(t('Transition to next'), F_TRANS, choices, cur)
      + (cur === 'custom' ? doorBtn(t('Reset to the deck transition'), 'resettrans', 'undo') : '');
  }

  /** Position, size, rotation and the CSS class - the fields only ONE box can answer. */
  function objectBody(b: Box): string {
    return `<div class="fc-dims-row"><span class="fc-dims-ic" data-tip="${escape(t('Position'))}">${icon('move')}</span>`
      + `${dimCell(t('X'), cfg.xField, dimOf(b, cfg.xField, 0), { name: t('X') })}`
      + `${dimCell(t('Y'), cfg.yField, dimOf(b, cfg.yField, 0), { name: t('Y') })}</div>`
      + `<div class="fc-dims-row"><span class="fc-dims-ic" data-tip="${escape(t('Size'))}">${icon('resize')}</span>`
      + `${dimCell(t('W'), cfg.wField, Math.max(1, dimOf(b, cfg.wField, 1)), { min: 1, max: 100000, name: t('Width') })}`
      + `${dimCell(t('H'), cfg.hField, Math.max(1, dimOf(b, cfg.hField, 1)), { min: 1, max: 100000, name: t('Height') })}</div>`
      + (cfg.rotationField
        ? `<div class="fc-dims-row"><span class="fc-dims-ic" data-tip="${escape(t('Rotation'))}">${icon('rotateCw')}</span>`
          + numCell(t('R'), cfg.rotationField, Math.round(clampN(fv(b, cfg.rotationField), 0, -180, 180)),
            { name: t('Rotation'), min: -180, max: 180, unit: 'deg' })
          + '</div>'
        : '')
      + textRow(t('CSS class'), 'cls', b['cls'], 'callout hero')
      // The two layer flags (M4). They live here rather than in a section of their own
      // because they are properties of the OBJECT, and because the canvas cannot offer
      // them: a hidden box is not drawn, and a locked one refuses every pointer - so the
      // navigator's row and this row are the only two ways back.
      + (F_HIDDEN ? toggleRow(t('Hidden'), F_HIDDEN, boolOf(fv(b, F_HIDDEN), false)) : '')
      + (F_LOCKED ? toggleRow(t('Locked'), F_LOCKED, boolOf(fv(b, F_LOCKED), false)) : '');
  }

  const strokeW = (b: Box): number => Math.max(0, Math.round(clampN(fv(b, cfg.strokeWField), 0, 0, 400)));

  function fillBody(b: Box, rows: Box[]): string {
    return (cfg.fillField
      ? colorRow(t('Fill'), 'fc-insp-fill', fv(b, cfg.fillField),
        `<button type="button" class="fc-cbtn fc-insp-mini" data-act="gradient">${t('Gradient')}</button>`,
        differs(rows, cfg.fillField))
      : '')
      + (cfg.strokeField ? colorRow(t('Stroke'), 'fc-insp-stroke', fv(b, cfg.strokeField), '', differs(rows, cfg.strokeField)) : '')
      + (cfg.strokeWField
        ? ctrlRow(FIELD_GLYPH.strokeIc, t('Stroke width'),
          numCell('', cfg.strokeWField, agree(rows, strokeW), { name: t('Stroke width'), min: 0, max: 400, unit: 'px' }))
        : '');
  }

  const opacityOf = (b: Box): number => Math.round(clampN(fv(b, cfg.opacityField), 100, 0, 100));
  const radiusOf = (b: Box): number => Math.max(0, Math.round(clampN(fv(b, cfg.radiusField), 0, 0, 200)));

  function appearanceBody(b: Box, rows: Box[]): string {
    const shapeChoices = shapeChoicesFrom(fieldDefs, cfg.shapeField);
    const blend = optionsOf(cfg.blendField);
    const opacity = agree(rows, opacityOf);
    const radius = agree(rows, radiusOf);
    return (cfg.opacityField ? sliderRow(FIELD_GLYPH.opacity, t('Opacity'), 'opacity', cfg.opacityField, opacity, opacityOf(b), 0, 100, { unit: '%' }) : '')
      + (cfg.blendField ? iconRow(FIELD_GLYPH.blend, t('Blend mode'),
        `<select class="field-select field-select--sm" data-fld="${escape(cfg.blendField)}" data-kind="str">`
        // Rows that disagree select a disabled "Mixed" entry rather than the first row's
        // mode: picking any real one from the list writes it to all of them, which is
        // what the control is for, but until the user picks it must not name one.
        + (differs(rows, cfg.blendField) ? `<option value="" selected disabled>${t('Mixed')}</option>` : '')
        + (blend.length ? blend : BLEND_FALLBACK.map((m) => [m, t(m[0]!.toUpperCase() + m.slice(1).replace('-', ' '))] as [string, string]))
          .map(([v, l]) => opt(v, l, differs(rows, cfg.blendField) ? null : (fv(b, cfg.blendField) ?? 'normal'))).join('')
        + '</select>') : '')
      + (cfg.radiusField ? sliderRow(FIELD_GLYPH.radius, t('Corner radius'), 'radius', cfg.radiusField, radius, radiusOf(b), 0, 200, { unit: 'px' }) : '')
      + (shapeChoices.length && cfg.shapeField ? segRow(FIELD_GLYPH.shRounded, t('Shape'), segHtml(cfg.shapeField, fv(b, cfg.shapeField) ?? 'rect', shapeChoices, t('Shape'))) : '');
  }

  function shadowBody(b: Box, rows: Box[]): string {
    const shadowChoices = shadowChoicesFrom(fieldDefs, cfg.shadowField);
    const shadowCur = String(fv(b, cfg.shadowField) ?? 'none');
    const shX = agree(rows, (r) => Math.round(clampN(fv(r, cfg.shadowXField), 0, -300, 300)));
    const shY = agree(rows, (r) => Math.round(clampN(fv(r, cfg.shadowYField), 0, -300, 300)));
    const shBlur = agree(rows, (r) => Math.round(clampN(fv(r, cfg.shadowBlurField), 10, 0, 300)));
    return (cfg.shadowField ? segRow(FIELD_GLYPH.shadowIc, t('Apply to'), segHtml(cfg.shadowField, shadowCur, shadowChoices, t('Apply to'))) : '')
      + (cfg.shadowColorField
        ? colorRow(t('Colour'), 'fc-insp-shadow', fv(b, cfg.shadowColorField) ?? '#00000055', '', differs(rows, cfg.shadowColorField))
        : '')
      + `<div class="fc-dims-row"><span class="fc-dims-ic" data-tip="${escape(t('Offset'))}">${icon('move')}</span>`
      + (cfg.shadowXField ? dimCell(t('X'), cfg.shadowXField, shX, { name: t('Shadow X'), min: -300, max: 300 }) : '')
      + (cfg.shadowYField ? dimCell(t('Y'), cfg.shadowYField, shY, { name: t('Shadow Y'), min: -300, max: 300 }) : '')
      + '</div>'
      // Blur gets a named row rather than a third axis cell: a one-letter label in a
      // row of X and Y reads as a third coordinate, which it is not.
      + (cfg.shadowBlurField
        ? ctrlRow(FIELD_GLYPH.shadowIc, t('Blur'), numCell('', cfg.shadowBlurField, shBlur, { name: t('Blur'), min: 0, max: 300, unit: 'px' }))
        : '');
  }

  function tiltBody(b: Box): string {
    const rx = Math.round(clampN(fv(b, cfg.rxField), 0, TILT_RANGE[0], TILT_RANGE[1]));
    const ry = Math.round(clampN(fv(b, cfg.ryField), 0, TILT_RANGE[0], TILT_RANGE[1]));
    return `<div class="fc-dims-row"><span class="fc-dims-ic" data-tip="${escape(t('Perspective tilt'))}">${icon('rotateCw')}</span>`
      + (cfg.rxField ? numCell(t('X'), cfg.rxField, rx, { name: t('Tilt X'), min: TILT_RANGE[0], max: TILT_RANGE[1], unit: 'deg' }) : '')
      + (cfg.ryField ? numCell(t('Y'), cfg.ryField, ry, { name: t('Tilt Y'), min: TILT_RANGE[0], max: TILT_RANGE[1], unit: 'deg' }) : '')
      + '</div>';
  }

  /** Align / distribute / z-order, as three rows of icon-only buttons with real names. */
  function arrangeGrid(n: number): string {
    const btn = (op: ArrangeOp, glyph: IconName, label: string, on: boolean): string =>
      `<button type="button" class="fc-insp-arr" data-arr="${op}" aria-label="${escape(label)}" data-tip="${escape(label)}"${on ? '' : ' disabled'}>${icon(glyph)}</button>`;
    return '<div class="fc-insp-arrs">'
      + btn('left', 'alignL', t('Align left'), true) + btn('hcentre', 'alignC', t('Align centre'), true) + btn('right', 'alignR', t('Align right'), true)
      + btn('top', 'alignT', t('Align top'), true) + btn('vcentre', 'alignM', t('Align middle'), true) + btn('bottom', 'alignB', t('Align bottom'), true)
      + '</div><div class="fc-insp-arrs">'
      + btn('h', 'distH', t('Distribute horizontally'), n >= 3) + btn('v', 'distV', t('Distribute vertically'), n >= 3)
      + btn('front', 'orderFront', t('Bring to front'), true) + btn('forward', 'orderForward', t('Bring forward'), true)
      + btn('backward', 'orderBackward', t('Send backward'), true) + btn('back', 'orderBack', t('Send to back'), true)
      + '</div><div class="fc-insp-arrs">'
      + btn('group', 'layers', t('Group'), n >= 2) + btn('ungroup', 'layersStack', t('Ungroup'), true)
      + '</div>';
  }

  function textBody(b: Box): string {
    const fontCur = String(fv(b, cfg.fontField) ?? '');
    const size = Math.max(1, Math.round(clampN(fv(b, cfg.fontSizeField), 48, 1, 2000)));
    const lh = Number.isFinite(parseFloat(String(fv(b, cfg.lineHeightField)))) ? parseFloat(String(fv(b, cfg.lineHeightField))) : 1.12;
    const tr = Number.isFinite(parseFloat(String(fv(b, cfg.trackingField)))) ? parseFloat(String(fv(b, cfg.trackingField))) : 0;
    // Defaults MUST match hooks.js textCss so an unset field shows the rendered value
    // (pad defaults to 8, not 0) - a control that lies about the current state is worse
    // than no control.
    const pad = Math.max(0, Math.round(Number.isFinite(parseFloat(String(fv(b, cfg.padField)))) ? parseFloat(String(fv(b, cfg.padField))) : 8));
    const fontChoices = fonts ? fonts.options() : [];
    const weightChoices = fonts ? fonts.weights(fontCur) : [];
    return (cfg.fontField && fontChoices.length ? selectRow(t('Font'), cfg.fontField, fontChoices, fontCur) : '')
      + (cfg.fontSizeField
        ? `<div class="fc-row"><span>${t('Size')}</span><div class="fc-stepper">`
          + `<button type="button" class="fc-cbtn" data-act="smaller" data-tip="${escape(t('Smaller'))}" aria-label="${escape(t('Smaller text'))}">A-</button>`
          + numCell('', cfg.fontSizeField, size, { name: t('Size'), min: 4, max: 2000, unit: 'px' })
          + `<button type="button" class="fc-cbtn" data-act="bigger" data-tip="${escape(t('Bigger'))}" aria-label="${escape(t('Bigger text'))}">A+</button>`
          + '</div></div>'
        : '')
      + (cfg.weightField && weightChoices.length ? selectRow(t('Weight'), cfg.weightField, weightChoices, String(fv(b, cfg.weightField) ?? '700')) : '')
      + (cfg.lineHeightField
        ? ctrlRow(FIELD_GLYPH.textM, t('Line height'),
          numCell('', cfg.lineHeightField, lh, { name: t('Line height'), min: 0.7, max: 3, step: 0.01 }))
        : '')
      + (cfg.trackingField
        ? ctrlRow(FIELD_GLYPH.textC, t('Letter spacing'),
          numCell('', cfg.trackingField, tr, { name: t('Letter spacing'), min: -20, max: 100, step: 0.5, precision: 2, unit: 'px' }))
        : '')
      + (cfg.ligaturesField ? toggleRow(t('Ligatures'), cfg.ligaturesField, boolOf(fv(b, cfg.ligaturesField), true)) : '')
      + (cfg.alternatesField ? toggleRow(t('Alternates'), cfg.alternatesField, boolOf(fv(b, cfg.alternatesField), false)) : '')
      + (cfg.fitTextField ? toggleRow(t('Shrink text to fit'), cfg.fitTextField, boolOf(fv(b, cfg.fitTextField), false)) : '')
      + (cfg.alignField ? segRow(FIELD_GLYPH.textL, t('Align'), segHtml(cfg.alignField, String(fv(b, cfg.alignField) ?? 'center'), [
        ['left', t('Align left'), FIELD_GLYPH.textL], ['center', t('Align centre'), FIELD_GLYPH.textC], ['right', t('Align right'), FIELD_GLYPH.textR]], t('Align'))) : '')
      + (cfg.valignField ? segRow(FIELD_GLYPH.textM, t('Vertical'), segHtml(cfg.valignField, String(fv(b, cfg.valignField) ?? 'middle'), [
        ['top', t('Align top'), FIELD_GLYPH.textT], ['middle', t('Centre vertically'), FIELD_GLYPH.textM], ['bottom', t('Align bottom'), FIELD_GLYPH.textB]], t('Vertical'))) : '')
      + (cfg.padField
        ? ctrlRow(FIELD_GLYPH.size, t('Padding'), numCell('', cfg.padField, pad, { name: t('Padding'), min: 0, max: 200, unit: 'px' }))
        : '')
      + (cfg.textColorField ? colorRow(t('Text colour'), 'fc-insp-fg', fv(b, cfg.textColorField)) : '');
  }

  function imageBody(b: Box): string {
    const fit = optionsOf(cfg.fitField);
    const fitChoices: Array<[string, string, string?]> = fit.length
      ? fit.map(([v, l]) => [v, l, ({ contain: FIELD_GLYPH.fitContain, cover: FIELD_GLYPH.fitCover, fill: FIELD_GLYPH.fitFill } as Record<string, string>)[v]])
      : [['contain', t('Contain'), FIELD_GLYPH.fitContain], ['cover', t('Cover (crop)'), FIELD_GLYPH.fitCover], ['fill', t('Stretch'), FIELD_GLYPH.fitFill]];
    return doorBtn(t('Set image'), 'pickimage', 'uploadImage')
      + (cfg.fitField ? segRow(FIELD_GLYPH.fitContain, t('Image fit'), segHtml(cfg.fitField, String(fv(b, cfg.fitField) ?? 'contain'), fitChoices, t('Image fit'))) : '')
      + (cfg.imgPosField ? segRow(FIELD_GLYPH.fitPos, t('Image position'), posGridHtml(cfg.imgPosField, String(fv(b, cfg.imgPosField) ?? 'center'), t('Image position'))) : '');
  }

  /**
   * APPEARS: the one control that says when a box arrives on its slide.
   *
   * Design grew three ways to answer that - a build step, a timeline start, and
   * "just show it" - and a box could carry two of them at once, which is how the
   * presenter, the video and the .pptx writer each ended up with their own idea of what
   * a slide does. The mode is DERIVED (`appearModeOf`), so nothing was migrated and a
   * link made before this reads back exactly as its author left it, and every press
   * writes the exclusive four-field patch `setAppear` returns - so the two other ways
   * are cleared in the same commit that sets this one.
   *
   * Frames are excluded by the caller: a slide appears when the deck reaches it, and
   * clearing a frame's own start/dur would retime the deck.
   */
  function appearRows(b: Box): string {
    const mode = appearModeOf(b);
    const step = Math.max(1, Math.round(clampN(b['build'], 1, 1, 999)));
    const startS = Math.max(0, clampN(fv(b, cfg.startField), 0, 0, 86400));
    const durS = Math.max(0, clampN(fv(b, cfg.durField), 0, 0, 86400));
    const seg = segHtml(APPEAR_SEG, mode, [
      ['slide', t('With the slide')],
      ['click', t('On click')],
      ['time', t('At time')],
    ], t('Appears'));
    // The number beside the mode is only ever the one that mode uses: a step for a
    // click, a start and a length for a time. Nothing offers a value the box is not
    // currently keeping, which is what makes the exclusivity visible rather than a rule.
    // The tips say what each number does on THIS surface (plans/184 R6): a build step is
    // a click, so a video or a PDF never sees it; a time is what a video and Auto-advance
    // play, and a click deck ignores it unless Auto-advance is on.
    const detail = mode === 'click'
      ? `<div class="fc-dims-row"><span class="fc-dims-ic" data-tip="${escape(t('A click step. A video or a PDF export does not wait for clicks, so it shows the box from the start.'))}">${icon('play')}</span>`
        + numCell(t('Step'), undefined, step, {
          name: t('Build step'), min: 1, max: 999,
          onCommit: (v) => applyAppear({ mode: 'click', step: v }),
        })
        + '</div>'
      : mode === 'time'
        ? `<div class="fc-dims-row"><span class="fc-dims-ic" data-tip="${escape(t('Timed: what a video and Auto-advance play. Presenting by click ignores the time unless Auto-advance is on.'))}">${icon('clock')}</span>`
          + numCell(t('At'), undefined, startS, {
            name: t('Appears at'), unit: 's', min: 0, max: 86400, step: 0.1, precision: 2,
            onCommit: (v) => applyAppear({ mode: 'time', startS: v }),
          })
          // A length of zero is open-ended, not "gone at once" - `setAppear` clears the
          // field for it, which is what the players read as "stays until the slide ends".
          + numCell(t('For'), undefined, durS, {
            name: t('Stays for'), unit: 's', min: 0, max: 86400, step: 0.1, precision: 2,
            onCommit: (v) => applyAppear({ mode: 'time', durS: v }),
          })
          + '</div>'
        : '';
    return `<div class="fc-row fc-insp-appear"><span>${t('Appears')}</span>${seg}</div>${detail}`;
  }

  /**
   * A press on one of the three segments. The box's OWN number is carried into the new
   * mode where it has one - a step it already had, a start it already had (`setAppear`
   * reads that one off the row itself) - so switching modes to look and switching back
   * costs nothing.
   */
  function applyAppearMode(v: string | undefined): void {
    const mode: AppearMode = v === 'click' || v === 'time' ? v : 'slide';
    const step = Math.max(1, Math.round(clampN(boxesById(renderedIds)[0]?.['build'], 1, 1, 999)));
    applyAppear(mode === 'click' ? { mode, step } : { mode });
  }

  /**
   * One press of the Appears control is ONE undo step, across the rows this column is
   * showing. It goes through `model.commit` rather than four `setField` calls because
   * the patch is four fields at once - the exclusivity IS the edit, and splitting it
   * would leave a box carrying both a build step and a start in between.
   */
  function applyAppear(intent: AppearIntent): void {
    if (!renderedIds.length) return;
    const patch = setAppear(boxesById(renderedIds)[0] ?? {}, intent);
    const want = new Set(renderedIds);
    model.commit(model.getBoxes().map((b, i) => (want.has(idOf(b, i)) ? { ...b, ...patch } : b)));
  }

  function motionBody(b: Box, isFrame: boolean): string {
    const secs = (v: unknown): string => {
      const n = parseFloat(String(v));
      return Number.isFinite(n) ? tRaw('{n}s', { n: String(Math.round(n * 100) / 100) }) : '-';
    };
    const enter = optionsOf(cfg.enterField);
    const exit = optionsOf(cfg.exitField);
    const kf = String(b[cfg.kfField ?? 'kf'] ?? '').trim();
    // The read-only half. Start / duration / hold / split / keyframes have ONE editor,
    // in the timeline: two doors onto one channel with different ranges is exactly the
    // drift plan 179 section 5.3 is about. The chips say what is set; the button opens
    // the place it is set.
    return (isFrame ? '' : appearRows(b))
      + '<div class="fc-insp-chips">'
      + (isFrame ? '' : chip(t('Appears'), appearSummary(b)))
      + chip(t('Start'), secs(b[cfg.startField ?? 'start']))
      + chip(t('Duration'), secs(b[cfg.durField ?? 'dur']))
      + chip(t('Hold'), String(b[cfg.holdField ?? 'hold'] ?? '-') || '-')
      + chip(t('Split'), String(b[cfg.splitField ?? 'split'] ?? '-') || '-')
      + chip(t('Keyframes'), kf ? String(kf.split(';').length) : '0')
      + '</div>'
      + doorBtn(t('Open in timeline'), 'timeline', 'animate')
      + (cfg.enterField && enter.length ? selectRow(t('Enter'), cfg.enterField, enter, String(fv(b, cfg.enterField) ?? 'fade')) : '')
      // Seconds, like Appears and the timeline badges - one time notation in the editor
      // (plans/184 R7). The field itself stays in ms; the cell converts both ways.
      + (cfg.enterMsField ? numRow(t('Enter'), cfg.enterMsField, msToS(clampN(fv(b, cfg.enterMsField), 400, 0, 60000)), {
          min: 0, max: 60, step: 0.1, precision: 1, unit: 's', onCommit: (v) => write(cfg.enterMsField, Math.round(v * 1000)),
        }) : '')
      + (cfg.exitField && exit.length ? selectRow(t('Exit'), cfg.exitField, exit, String(fv(b, cfg.exitField) ?? 'fade')) : '')
      + (cfg.exitMsField ? numRow(t('Exit'), cfg.exitMsField, msToS(clampN(fv(b, cfg.exitMsField), 400, 0, 60000)), {
          min: 0, max: 60, step: 0.1, precision: 1, unit: 's', onCommit: (v) => write(cfg.exitMsField, Math.round(v * 1000)),
        }) : '');
  }

  /**
   * The present-time fields, SPLIT BY WHO ACTUALLY OWNS THEM.
   *
   * `state`, `notes` and `stackOf` are frame fields; `build`, `matchOf` and
   * `presentAudio` are read off child boxes and nowhere else (hooks.js emits
   * `data-build` / `data-match` per child, and `presentAudio` inside the video
   * branch). Offering all six on a slide wrote "Build step 2" to the frame row, where
   * nothing reads it, so the control silently did nothing; meanwhile the box that does
   * own the field had no inspector row at all. free-canvas's context menu already splits them
   * exactly this way (the build radios and "Morph match…" are pushed only for a single
   * non-frame selection).
   */
  function presentBody(b: Box, isFrame: boolean): string {
    if (isFrame) {
      // Speaker notes sit HERE, not in Artboard: what you say over a slide is a present-
      // time answer, and narration (plans/180) reads this exact field, so the words and
      // the button that speaks them have to be one control away from each other. Still
      // the only door onto `notes` - two doors onto one field is the drift this column
      // exists to end.
      return areaRow(t('Speaker notes'), 'notes', b['notes'], t('What to say on this slide…'))
        + narrateRows(b)
        + textRow(t('Slide style'), 'state', b['state'], 'dark title-slide')
        + readRow(t('Stack'), String(b['stackOf'] ?? '') || '-');
    }
    return numRow(t('Build step'), 'build', Math.round(clampN(b['build'], 0, 0, 999)), { min: 0, max: 999 },
        t('A click step while presenting. A video or a PDF export shows the box from the start.'))
      + textRow(t('Morph match'), 'matchOf', b['matchOf'], 'hero')
      + textRow(t('Slide audio'), 'presentAudio', b['presentAudio']);
  }

  /**
   * Notes to voice for THIS slide (plans/180 section 8), directly under the notes it
   * speaks. The line above the button is the same four-state answer the navigator's dot
   * gives, in words: a dot can only be pointed at, and the one state that asks the author
   * for a decision - the notes changed after the voice was made - has to be readable.
   *
   * No notes, no button: narrating an empty slide would produce a clip of silence and a
   * credential claiming a voice said nothing.
   */
  function narrateRows(b: Box): string {
    if (!narration || opts.narrationEnabled?.() === false) return '';
    const id = String(b[cfg.idField ?? 'id'] ?? '');
    if (!id) return '';
    const st: NarrationStatus = narration.status(id);
    if (st === 'none') return '';
    return `<p class="fc-insp-hint" data-narration="${st}">${escape(narrationWord(st))}</p>`
      + doorBtn(st === 'pending' ? t('Narrate this slide') : t('Narrate this slide again'), 'narrate', 'speech');
  }

  /** What a narration state says in the column, in words rather than as a colour. */
  function narrationWord(st: NarrationStatus): string {
    if (st === 'current') return t('Narrated from these notes.');
    if (st === 'stale') return t('The notes changed after this slide was narrated.');
    return t('Not narrated yet.');
  }

  function guideBody(guide: DesignGuide): string {
    const id = guide.id;
    const scale = CSS_PX_PER_UNIT[documentUnit()];
    const position = (axis: 'x' | 'y', label: string): string =>
      `<div class="fc-row"><span>${label}</span>${dimCell('', `guide-${axis}`, guide[axis], {
        name: label, onCommit: value => opts.guides?.update(id, { [axis]: value * scale }),
      })}</div>`;
    return position('x', t('X position')) + position('y', t('Y position'))
      + numRow(t('Rotation'), 'guide-rotation', guide.rotation, {
        name: t('Guide rotation'), unit: '°', step: 1, precision: 2,
        onCommit: value => opts.guides?.update(id, { rotation: value }),
      })
      + colorRow(t('Colour'), 'fc-insp-guide', guide.color || 'var(--ui-color-action-primary)')
      + toggleRow(t('Snap objects to guide'), 'guide-snap', guide.snap)
      + `<p class="fc-insp-hint">${t('Rotation is clockwise around X / Y. Hold Shift while dragging for 10 px steps. Hold Alt while moving objects to bypass snapping.')}</p>`
      + doorBtn(t('Delete guide'), 'delete-guide', 'trash');
  }

  function bodyFor(sec: InspectorSection, g: Gate): string {
    if (sec === 'document') return documentBody();
    if (sec === 'guide' && g.kind === 'guide') return guideBody(g.guide);
    const b = (g.box ?? {}) as Box;
    // The paint groups are the only ones a multi-selection shows, so they are the only
    // ones handed every row: the rest answer for one box by construction (see `gate`).
    const rows = g.rows.length ? g.rows : [b];
    if (sec === 'artboard') return artboardBody(b);
    if (sec === 'object') return objectBody(b);
    if (sec === 'fill') return fillBody(b, rows);
    if (sec === 'appearance') return appearanceBody(b, rows);
    if (sec === 'shadow') return shadowBody(b, rows);
    if (sec === 'tilt') return tiltBody(b);
    if (sec === 'arrange') return arrangeGrid(g.ids.length);
    if (sec === 'text') return textBody(b);
    if (sec === 'image') return imageBody(b);
    if (sec === 'motion') return motionBody(b, g.kind === 'frame');
    return presentBody(b, g.kind === 'frame');
  }

  // ── render ──────────────────────────────────────────────────────────────────

  /** `CSS.escape` where the platform has it (jsdom does not), for a manifest field name. */
  const q = (s: unknown): string =>
    (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') ? CSS.escape(String(s)) : String(s).replace(/["\\]/g, '\\$&');

  /**
   * A selector that re-finds the focused control after a rebuild - its FIELD identity,
   * not its node. Only the controls that commit during the interaction can be focused
   * when a rebuild runs (a text field defers its own rebuild, so it never reaches
   * here and no caret offset has to be carried).
   */
  function focusKey(node: Element | null): string | null {
    if (!node || !scroll.contains(node)) return null;
    const d = (node as HTMLElement).dataset;
    const seg = node.closest<HTMLElement>('.fc-seg');
    if (seg && d?.v != null) return `.fc-seg[data-seg="${q(seg.dataset.seg)}"] .fc-seg-btn[data-v="${q(d.v)}"]`;
    for (const attr of ['fld', 'doc', 'nf', 'dm', 'mp', 'arr', 'act', 'head'] as const) {
      if (d?.[attr] != null) return `[data-${attr}="${q(d[attr])}"]`;
    }
    const cf = node.closest<HTMLElement>('[data-color-field]');
    if (cf) return `[data-color-field="${q(cf.dataset.colorField)}"] .color-trigger`;
    return null;
  }

  function render(g: Gate): void {
    const keep = focusKey(typeof document !== 'undefined' ? document.activeElement : null);
    renderedIds = [...g.ids];
    renderedGuideId = g.kind === 'guide' ? g.guide.id : null;
    // The number cells go with the markup that held them: their listeners are on nodes
    // this write is about to throw away, and a pending arrow-key commit must not fire
    // from inside the rebuild that replaced its field.
    for (const h of numMounted) h.destroy();
    numMounted = [];
    numSpecs = [];
    // The column head says WHAT is selected; a multi-selection has no one section that
    // could carry the count now that the paint groups stand on their own.
    colTitle.textContent = g.kind === 'multi' ? t('{n} selected', { n: g.ids.length }) : t('Inspector');
    scroll.innerHTML = g.secs.map((sec) => {
      const openSec = isExpanded(sec, g);
      return `<section class="fc-insp-sec" data-sec="${sec}">`
        + `<button type="button" class="fc-insp-head" data-head="${sec}" aria-expanded="${openSec}">`
        + `${icon(SECTION_META[sec].glyph)}<span>${escape(SECTION_META[sec].title())}</span>`
        + `<i class="fc-insp-caret" aria-hidden="true"></i></button>`
        + `<div class="fc-insp-rows" data-rows="${sec}"${openSec ? '' : ' hidden'}>${bodyFor(sec, g)}</div>`
        + '</section>';
    }).join('') || `<p class="fc-insp-hint">${t('Nothing selected')}</p>`;
    mountNums();
    wire();
    if (g.secs.includes('document')) scheduleMountedAudit();
    // Put the user back on the control they were operating. `preventScroll` because a
    // restore is not a navigation: scrolling the column to it would move the rows the
    // pointer is over.
    if (keep) scroll.querySelector<HTMLElement>(keep)?.focus({ preventScroll: true });
  }

  /** Swap every number placeholder for the control the body asked for. */
  function mountNums(): void {
    numByPair.clear();
    for (const spec of numSpecs) {
      const slot = scroll.querySelector<HTMLElement>(`[data-num-slot="${q(spec.key)}"]`);
      if (!slot) continue;
      const h = numField(spec.opts);
      slot.replaceWith(h.el);
      numMounted.push(h);
      if (spec.pair) numByPair.set(spec.pair, h);
    }
  }

  /** Keep a slider on the number its own cell is showing, while the cell is being dragged. */
  function mirrorRange(key: string, v: number): void {
    const rng = scroll.querySelector<HTMLInputElement>(`input[type="range"][data-num="${q(key)}"]`);
    if (rng) rng.value = String(v);
  }

  // ── wiring ──────────────────────────────────────────────────────────────────

  /**
   * One field write across the rows THIS COLUMN IS SHOWING - one commit, one undo step.
   *
   * `renderedIds`, never `selection.get()`. A text input or textarea commits on
   * `change`, which is at BLUR, and `sync()` deliberately holds the rebuild off while
   * the caret is in the column - so the row stays mounted across a selection change
   * and the live selection is no longer the one the user typed into. That path deleted
   * a slide's speaker notes and stamped them onto an unrelated box, in one undo step
   * labelled as a box edit.
   */
  function write(field: string | undefined, value: unknown): void {
    if (renderedGuideId && field === 'guide-snap') {
      opts.guides?.update(renderedGuideId, { snap: Boolean(value) });
      return;
    }
    if (!field || !renderedIds.length) return;
    // A hand-set Enter or Exit on an ARTBOARD is the author overriding the deck, and it
    // has to say so in the same commit - exactly as the timeline's copy of these two
    // selects does (`frameTrans` there). Without the stamp `slideTransition` stayed '',
    // so the next "Place in order" counted the frame as unauthored and derived the deck's
    // pair straight over a hand-set Cut, and the navigator chip and its "Reset to the
    // deck transition" row never appeared for the edit. Two doors onto one field showing
    // two different states is the drift this column exists to end.
    if (F_TRANS && (field === cfg.enterField || field === cfg.exitField) && everyRowIsFrame()) {
      const want = new Set(renderedIds);
      model.commit(model.getBoxes().map((b, i) => (
        want.has(idOf(b, i)) ? { ...b, [field]: value as Box[string], [F_TRANS]: 'custom' } : b
      )));
      return;
    }
    model.setField([...renderedIds], field, value);
  }

  /** Is every row this column is showing an artboard? (No frame primitive ⇒ never.) */
  function everyRowIsFrame(): boolean {
    if (!frame) return false;
    const want = new Set(renderedIds);
    const rows = model.getBoxes().filter((b, i) => want.has(idOf(b, i)));
    return rows.length > 0 && rows.every((b) => kindOf(b) === frame.frameKind);
  }

  /** Which model field each colour trigger id writes. */
  function colorTarget(id: string): string | undefined {
    if (id === 'fc-insp-fill') return cfg.fillField;
    if (id === 'fc-insp-stroke') return cfg.strokeField;
    if (id === 'fc-insp-fg') return cfg.textColorField;
    if (id === 'fc-insp-shadow') return cfg.shadowColorField;
    return undefined;
  }

  function wire(): void {
    wireSegs(scroll, (field, v) => {
      // The Appears segments are the one control here that is not a field: they write
      // four at once (see `applyAppear`), so they are routed rather than written.
      if (field === APPEAR_SEG) { applyAppearMode(v); return; }
      write(field, v);
    });

    wireColorField(scroll, {
      onChange: (id, val) => {
        const colour = unwrapColor(val);
        if (id === 'fc-insp-guide' && renderedGuideId) { opts.guides?.update(renderedGuideId, { color: colour }); return; }
        if (id === 'fc-insp-bg') { model.setInput('background', colour); return; }
        write(colorTarget(id), colour);
      },
    });

    scroll.querySelectorAll<HTMLSelectElement>('select[data-fld]').forEach((sel) => {
      sel.addEventListener('change', () => write(sel.dataset.fld, sel.value));
    });

    // The DOCUMENT's own settings (plans/180's narration inputs, and the captions flag).
    // They write a top-level input, so they never travel through `write` and can never be
    // stamped onto the selected rows - see `docTextRow`. The number cells beside them
    // commit through their own `onCommit`, which is why only text and checkbox are here.
    scroll.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[data-doc], select[data-doc]').forEach((inp) => {
      inp.addEventListener('change', () => {
        const id = inp.dataset.doc;
        if (!id) return;
        model.setInput(id, inp instanceof HTMLInputElement && inp.dataset.kind === 'bool' ? inp.checked : inp.value.trim());
        // The size menu and export sheet are long-lived peers of this detached column;
        // tell their canvas owner when a document setting changed here as well.
        if (id === 'documentUnit') canvasEl.dispatchEvent(new CustomEvent('fc-document-unit', { detail: inp.value.trim() }));
        if (id === 'documentDpi') canvasEl.dispatchEvent(new CustomEvent('fc-document-dpi', { detail: Number(inp.value) }));
      });
    });

    // The narration voice pickers (docVoiceRows): three controls, one top-level input.
    const voiceSels = scroll.querySelectorAll<HTMLSelectElement>('select[data-doc-voice]');
    if (voiceSels.length) {
      const commitVoice = (): void => {
        const main = (scroll.querySelector<HTMLSelectElement>('select[data-doc-voice="main"]')?.value || KOKORO_DEFAULT_VOICE).trim();
        const blend = (scroll.querySelector<HTMLSelectElement>('select[data-doc-voice="blend"]')?.value || '').trim();
        const wEl = scroll.querySelector<HTMLInputElement>('input[data-doc-voice="weight"]');
        const w = wEl ? clampN(wEl.value, 30, 5, 95) : 30;
        model.setInput('narrationVoice', blend && blend !== main ? `${main}+${blend}:${(w / 100).toFixed(2)}` : main);
      };
      voiceSels.forEach((sel) => sel.addEventListener('change', commitVoice));
      scroll.querySelector<HTMLInputElement>('input[data-doc-voice="weight"]')?.addEventListener('change', commitVoice);
      void fillVoiceOptions(voiceSels);
    }

    scroll.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[data-fld], textarea[data-fld]').forEach((inp) => {
      const kind = inp.dataset.kind;
      const type = (inp as HTMLInputElement).type;
      if (kind === 'bool') {
        inp.addEventListener('change', () => write(inp.dataset.fld, (inp as HTMLInputElement).checked));
        return;
      }
      if (type === 'range') {
        // The number cell beside it mirrors the drag; the model hears about it once,
        // on release. Two controls on one value, one commit between them.
        inp.addEventListener('input', () => {
          const key = (inp as HTMLInputElement).dataset.num;
          const n = parseFloat(inp.value);
          if (key && Number.isFinite(n)) numByPair.get(key)?.set(n);
        });
        inp.addEventListener('change', () => {
          const n = parseFloat(inp.value);
          if (Number.isFinite(n)) write(inp.dataset.fld, n);
        });
        return;
      }
      inp.addEventListener('change', () => {
        if (kind !== 'num') { write(inp.dataset.fld, inp.value); return; }
        let n = parseFloat(inp.value);
        if (!Number.isFinite(n)) return;
        const min = (inp as HTMLInputElement).min, max = (inp as HTMLInputElement).max;
        if (min !== '' && Number.isFinite(parseFloat(min))) n = Math.max(parseFloat(min), n);
        if (max !== '' && Number.isFinite(parseFloat(max))) n = Math.min(parseFloat(max), n);
        write(inp.dataset.fld, Math.round(n * 100) / 100);
      });
    });

    scroll.querySelectorAll<HTMLButtonElement>('[data-arr]').forEach((btn) => {
      btn.addEventListener('click', () => actions.arrange(btn.dataset.arr!));
    });

    scroll.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        // The rows the door is ON, for the same reason `write` uses them: a door in a
        // row built for one selection must not open on another.
        const ids = [...renderedIds];
        switch (btn.dataset.act) {
          case 'delete-guide': if (renderedGuideId) opts.guides?.remove(renderedGuideId); break;
          case 'gradient': actions.openGradient(ids); break;
          case 'pickimage': actions.pickImage(ids); break;
          case 'timeline': actions.openTimeline('animate', ids[0] ?? ''); break;
          // Back to the deck's own transition. '' is the manifest default and the value
          // the players read as "follow the document", so clearing it is the whole verb.
          case 'resettrans': write(F_TRANS, ''); break;
          // The slide this row was built for, never the live selection: the notes above
          // the button commit at blur, so the press that follows can arrive after the
          // canvas has moved on (the same rule `write` keeps).
          case 'narrate': if (ids[0]) narration?.narrateFrame(ids[0]); break;
          case 'smaller': case 'bigger': bumpFont(btn.dataset.act === 'bigger' ? 6 : -6); break;
          default: break;
        }
      });
    });

    // A header is a real button, so Enter and Space toggle it with no key handling of
    // our own; the click is all there is to bind.
    scroll.querySelectorAll<HTMLButtonElement>('[data-head]').forEach((btn) => {
      btn.addEventListener('click', () => toggleSection(btn.dataset.head as InspectorSection));
    });
  }

  /** A/A- steps the size of every box THIS COLUMN SHOWS by `d`, floored at 4 - one commit. */
  function bumpFont(d: number): void {
    if (!cfg.fontSizeField) return;
    const rows = boxesById(renderedIds);
    const cur = Math.round(clampN(rows[0]?.[cfg.fontSizeField], 48, 1, 2000));
    write(cfg.fontSizeField, Math.max(4, cur + d));
  }

  /** The user's own answer about a section, remembered for next time. */
  function setSectionOpen(sec: InspectorSection, wantOpen: boolean): void {
    sectionPrefs[sec] = wantOpen;
    writeSectionPrefs(sectionPrefs);
    paintSectionState(sec, wantOpen);
  }

  function toggleSection(sec: InspectorSection): void {
    const head = scroll.querySelector<HTMLElement>(`[data-head="${sec}"]`);
    setSectionOpen(sec, head?.getAttribute('aria-expanded') !== 'true');
  }

  function paintSectionState(sec: InspectorSection, openSec: boolean): void {
    const head = scroll.querySelector<HTMLElement>(`[data-head="${sec}"]`);
    const rows = scroll.querySelector<HTMLElement>(`[data-rows="${sec}"]`);
    head?.setAttribute('aria-expanded', String(openSec));
    if (rows) rows.hidden = !openSec;
  }

  // ── repaint memo ────────────────────────────────────────────────────────────

  /**
   * The signature the repaint is memoised on: what is selected, plus the values of
   * exactly the fields the VISIBLE sections read. Appended to, never trimmed - a
   * section that grows a control must grow its `WATCHED` entry in the same edit, or
   * the control shows a stale value until the next selection change.
   */
  function signature(g: Gate): string {
    const watched: unknown[] = [g.kind === 'guide' ? g.guide : null, model.getInput('documentUnit')];
    for (const sec of g.secs) {
      // EVERY selected row, not just the first. A paint group's cells read them all to
      // decide whether to show a number or "Mixed", so a change to the second box's
      // opacity has to move the signature or the cell keeps saying they agree.
      for (const f of WATCHED[sec](cfg, m4)) watched.push(f ? g.rows.map((r) => r[f]) : null);
    }
    // Document's readout is the one value that is NOT in the model - it measures the
    // canvas - so it is hashed here and woken by the canvas's own `canvas-resize`.
    const size = g.secs.includes('document') ? canvasSize() : null;
    const doc = size ? [model.getInput('background'), size.w, size.h, model.getBoxes()] : [];
    // Narration status is the OTHER value no watched field carries: it is derived from
    // the `narration:<frameId>` clip's resolved asset meta, on a different row entirely.
    // Without it the Present section kept saying "Not narrated yet." after a successful
    // narrate whose dwell floor happened to change nothing the field hash could see. The
    // navigator solved the same problem by putting the status into its own row memo.
    const narrationOn = opts.narrationEnabled?.() !== false;
    const narr = narration && narrationOn && g.secs.includes('present')
      ? g.ids.map((id) => narration.status(id)).join(',')
      : '';
    let json = '';
    try { json = JSON.stringify([watched, doc]); } catch { json = String(watched.length); }
    return `${g.kind}|${g.ids.join(',')}|${g.secs.join(',')}|${narr}|${json}`;
  }

  /**
   * True while the column holds a focused text field. The model echo of a commit arrives
   * mid-gesture; rebuilding then replaces the very input the caret is in, which loses
   * the caret and any text typed since. Deferred to `focusout`.
   */
  function typingHere(): boolean {
    const a = typeof document !== 'undefined' ? document.activeElement : null;
    if (!a || !el.contains(a)) return false;
    const tag = a.tagName;
    if (tag === 'TEXTAREA') return true;
    return tag === 'INPUT' && ['text', 'search', 'url', 'number'].includes((a as HTMLInputElement).type);
  }

  /**
   * The same gesture in the other control on the row: a slider is dragged, not typed,
   * and `type="range"` is not one of the inputs `typingHere` counts, so a drag on the
   * Opacity or Corner radius slider was as invisible to a rebuild as a scrub. Replacing
   * the slider under a captured pointer loses the drag, and the `change` that would have
   * committed it never fires.
   */
  let rangeDrag = false;
  const onRangeDown = (ev: Event): void => {
    const target = ev.target as HTMLElement | null;
    if (target && typeof target.closest === 'function' && target.closest('input[type="range"]')) rangeDrag = true;
  };
  const onRangeUp = (): void => { rangeDrag = false; };
  scroll.addEventListener('pointerdown', onRangeDown);
  if (typeof document !== 'undefined') {
    document.addEventListener('pointerup', onRangeUp, true);
    document.addEventListener('pointercancel', onRangeUp, true);
  }

  /**
   * True while a rebuild would destroy the thing the user is standing in.
   *
   * The caret is one such thing; a LIVE SCRUB on a number cell or a slider is the
   * second, and an
   * OPEN COLOUR POPOVER is the third, and it is the
   * one that made the pickers single-click. The picker emits on every change - each
   * swatch click, each slider `input` - so the commit's own model echo came straight
   * back here and the column's one raw-HTML write deleted the popover the user was
   * working in (with its mode tabs, alpha row, eyedropper and sliders), one gesture
   * in. The overlay guards its background swatch the same way (`free-canvas.ts` `syncBgField`:
   * "rebuilding the field under an open popover would close it mid-edit"), and it has
   * to be a guard rather than a narrower memo: the field being edited IS a watched
   * field, so the signature legitimately changes on every emit.
   *
   * The scrub is invisible to both of the other two checks: `numField` cancels the
   * label's pointerdown so a press on it does not put a caret in the number, so nothing
   * in this column is focused for the whole drag. Rebuilding then destroys the field the
   * pointer is captured on, the value snaps back under the finger, and the release
   * commits nothing - which is what the timeline playing, a collab peer moving the box,
   * or one `canvas-resize` tick did to every drag before the cells were asked.
   */
  function heldOpen(): boolean {
    return typingHere()
      || numMounted.some((h) => h.scrubbing())
      || rangeDrag
      || !!scroll.querySelector('.color-popover:not([hidden])');
  }

  /**
   * A deferral has to end somewhere, and nothing announces "the popover closed" or
   * "the caret left" on its own: the picker closes on a document `pointerdown`, on
   * Escape, or on a scroll that is not its own. So a deferral arms three document
   * listeners that re-check once the gesture has settled, and disarms them the moment
   * the rebuild runs - nothing is armed in the common case. The check itself is
   * coalesced to one timeout, because a scroll fires dozens of times per gesture and
   * each re-check would otherwise queue its own.
   */
  let settleArmed = false;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  const settle = (): void => {
    if (settleTimer != null) return;
    settleTimer = setTimeout(() => {
      settleTimer = null;
      if (!destroyed && pendingRebuild && !heldOpen()) sync(true);
    }, 0);
  };
  function armSettle(): void {
    if (settleArmed || typeof document === 'undefined') return;
    settleArmed = true;
    document.addEventListener('pointerup', settle, true);
    document.addEventListener('keyup', settle, true);
    document.addEventListener('scroll', settle, true);
  }
  function disarmSettle(): void {
    if (settleTimer != null) { clearTimeout(settleTimer); settleTimer = null; }
    if (!settleArmed || typeof document === 'undefined') return;
    settleArmed = false;
    document.removeEventListener('pointerup', settle, true);
    document.removeEventListener('keyup', settle, true);
    document.removeEventListener('scroll', settle, true);
  }

  function sync(force = false): void {
    if (destroyed) return;
    // A CLOSED column paints nothing. The three subscriptions stay live - they are how
    // it knows what to paint when it opens - but a rebuild behind `hidden` costs a full
    // innerHTML plus a re-mount of the real colour picker (which reads computed styles)
    // for something nobody can see. Dropping the memo makes the next open paint fresh.
    if (!open) { lastSig = null; pendingRebuild = false; disarmSettle(); return; }
    const g = gate();
    const sig = signature(g);
    if (!force && sig === lastSig) return;
    if (heldOpen()) { pendingRebuild = true; armSettle(); return; }
    lastSig = sig;
    pendingRebuild = false;
    disarmSettle();
    render(g);
  }

  // The caret leaving is the commonest end of a deferral, and `focusout` fires BEFORE
  // focus moves - so it goes through the same settle check as everything else rather
  // than deciding on the spot.
  el.addEventListener('focusout', settle);

  // ── the keyboard gate ───────────────────────────────────────────────────────

  /**
   * Where focus came from when the object bar `reveal()`d a section, so Escape can put
   * it back. Cleared once spent: a stale claim would yank the keyboard out of whatever
   * the user had moved on to.
   */
  let returnFocus: HTMLElement | null = null;

  /**
   * THE GATE. free-canvas binds its shortcuts on `window` and bails only for a typing
   * target (INPUT/TEXTAREA/SELECT/contenteditable) or focus inside `.tl-panel`. Every
   * control in this column that is not one of those - the section headers, the fourteen
   * arrange buttons, the segment buttons, the doors - was therefore a live canvas
   * keyboard surface: Backspace to correct something on a focused "Align left" DELETED
   * the box, ArrowDown on a header nudged it and pushed an undo step, `v`/`p`/`n`
   * switched tools, `\` hid every piece of chrome, and Space armed the canvas pan while
   * the user was activating a button with it. The navigator closes this same hole in the
   * same way (`onRootKey` there); this column has to do it for itself.
   *
   * App-wide chords still travel: they carry meta/ctrl and mean the same thing wherever
   * focus is (⌘Z undo, ⌘S save, ⌘Return present, all bound on `window`).
   */
  function onRootKey(ev: KeyboardEvent): void {
    if (ev.metaKey || ev.ctrlKey) return;
    if (ev.key === 'Escape') {
      // Escape here must NOT reach the editor's ladder. With the column mounted the
      // object bar's buttons open no floating panel, so `dismissFloating()` finds
      // nothing and the ladder falls through to "clear the selection" - which threw the
      // selection away, re-gated the column to Document, rewrote the whole scroll body
      // out from under the focused header, and left focus on <body>. Backing out of a
      // reveal means going back where you came from, nothing more.
      ev.preventDefault();
      ev.stopPropagation();
      const back = returnFocus;
      returnFocus = null;
      // Nowhere recorded (the user tabbed in themselves) leaves focus exactly where it
      // is - which is still a live, reachable control, unlike <body>.
      if (back?.isConnected) back.focus();
      return;
    }
    ev.stopPropagation();
  }
  el.addEventListener('keydown', onRootKey);

  // ── open / close ────────────────────────────────────────────────────────────

  function paintOpen(): void {
    el.classList.toggle('is-closed', !open);
    el.hidden = !open;
    // Always 0. Reported once, and only on a change, so a host that pushes column widths
    // hears "this one reserves nothing" instead of nothing at all.
    if (lastWidth !== 0) { lastWidth = 0; opts.onWidthChange?.(0); }
  }

  function setOpen(b: boolean): void {
    if (open === b) return;
    open = b;
    paintOpen();
    opts.onOpenChange?.(open);
    if (open) sync(true);
  }

  // ── mount ───────────────────────────────────────────────────────────────────

  boxesAuditKey = currentBoxesAuditKey();
  const unsubModel = model.subscribe(() => {
    const next = currentBoxesAuditKey();
    if (next !== boxesAuditKey) {
      boxesAuditKey = next;
      waitingForCanvasPaint = true;
      mountedAudit = null;
      mountedAuditKey = '';
      mountedAuditGeneration++;
    }
    sync();
  });
  const unsubSel = selection.onChange(() => sync());
  const unsubGuides = opts.guides?.onChange(() => sync());
  const unsubArt = artboard.onChange(() => sync());
  // Document's "Canvas size" is measured, not read from the model, so no model write
  // announces a resize and the readout used to sit on the old dimensions until some
  // unrelated edit happened to move the signature. `canvas-resize` is the app's own
  // event for exactly this (design-topbar and the overlay both dispatch it at the
  // canvas after a size change, and tool.ts's fitCanvas listens for it); the
  // ResizeObserver catches the changes nobody announces. Both land in the same memo,
  // so a resize that changes nothing visible costs one string compare.
  const onCanvasResize = (): void => {
    mountedAudit = null;
    mountedAuditKey = '';
    mountedAuditRevision++;
    sync();
    scheduleMountedAudit();
  };
  const onCanvasPaint = (): void => {
    waitingForCanvasPaint = false;
    mountedAuditRevision++;
    scheduleMountedAudit(true);
  };
  canvasEl.addEventListener('canvas-resize', onCanvasResize);
  canvasEl.addEventListener('lolly-canvas-painted', onCanvasPaint);
  // Being in a dock slot IS being open. The host docks and undocks this element (its own
  // close button asks it to, through `onClose`), and without this the panel could be put
  // in a slot while its internal state still said "closed" - an empty sidebar with a
  // live-but-hidden panel inside it. Only a change that actually moved THIS element is
  // acted on, so a standalone mount (no dock at all) is untouched.
  const offDock = onDockChange(() => {
    const inSlot = isDocked(DOCK_ID) && !!el.parentElement?.classList.contains('edge-dock-slot');
    if (inSlot !== open && (inSlot || el.parentElement === null)) setOpen(inSlot);
  });
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onCanvasResize) : null;
  ro?.observe(canvasEl);
  paintOpen();
  sync(true);

  return {
    el,
    setOpen,
    isOpen: () => open,
    sync: () => sync(true),
    width: () => 0,
    reveal(section: InspectorSection): void {
      // Remembered BEFORE focus moves, so Escape can hand the keyboard back to the
      // object-bar button (or wherever else) that asked for this section.
      const from = typeof document !== 'undefined' ? document.activeElement as HTMLElement | null : null;
      returnFocus = from && !el.contains(from) ? from : returnFocus;
      if (!open) setOpen(true);
      // The object bar asks for 'object' when its Stroke and More buttons are pressed
      // (views/design-ports.ts pins that call to the seven original names), and a
      // multi-selection has no Object section any more - so fall through to the first
      // group that IS there rather than opening the column onto nothing.
      const want = scroll.querySelector(`.fc-insp-sec[data-sec="${q(section)}"]`)
        ? section
        : (section === 'object' ? 'fill' : section);
      const sec = scroll.querySelector<HTMLElement>(`.fc-insp-sec[data-sec="${q(want)}"]`);
      if (!sec) return;
      setSectionOpen(want, true);
      const head = sec.querySelector<HTMLButtonElement>('.fc-insp-head');
      if (typeof sec.scrollIntoView === 'function') sec.scrollIntoView({ block: 'nearest' });
      head?.focus();
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      returnFocus = null;
      for (const h of numMounted) h.destroy();
      numMounted = [];
      el.removeEventListener('focusout', settle);
      el.removeEventListener('keydown', onRootKey);
      scroll.removeEventListener('pointerdown', onRangeDown);
      if (typeof document !== 'undefined') {
        document.removeEventListener('pointerup', onRangeUp, true);
        document.removeEventListener('pointercancel', onRangeUp, true);
      }
      disarmSettle();
      canvasEl.removeEventListener('canvas-resize', onCanvasResize);
      canvasEl.removeEventListener('lolly-canvas-painted', onCanvasPaint);
      mountedAuditGeneration++;
      offDock();
      ro?.disconnect();
      unsubModel();
      unsubSel();
      unsubGuides?.();
      unsubArt();
      el.remove();
      opts.onWidthChange?.(0);
    },
  };
}
