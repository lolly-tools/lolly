// SPDX-License-Identifier: MPL-2.0
/**
 * What the `#/rebrand` view suites share, so each region's suite runs on its own: the
 * stylesheets read as one text, and the two harnesses the region suites mount the real
 * modules with. Test code only; nothing in the app imports it.
 *
 * `rebrandCss()` joins every `styles/parts/rebrand*.css`, so a test that pins a rule
 * keeps passing when the rule moves to another region's sheet.
 *
 * `reviewHarness()` is the review surface over tests/fixtures/rebrand/adversarial.pptx:
 * the queue, the comparison, the decision column, the filmstrip and the keys, wired the
 * way views/rebrand.ts wires them, against a stub controller that records each command
 * and answers ok. The pipeline runs once per process, the first time it is asked for.
 *
 * `frameHarness()` is the frame over the committed samples (tests/fixtures/rebrand/
 * samples): the intake, the top bar, the footer and the report drawer, against
 * `StubController`, so the numbers on screen are checked against `planSummary` rather
 * than against figures written into a test. The orchestrator's layout rule for the
 * report drawer (hidden unless open) is repeated here because it is what Esc has to undo.
 *
 * A suite installs its own DOM globals first and calls a harness after, since the
 * modules read those globals when they load.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { compileFaithful, reviewQueue } from '@lolly/engine';
import { ARCHETYPE_IDS } from '@lolly-tools/core';
import type { CompiledDeckV1, DeckCensusV1, RenovationPlanV1, RenovationProjectV1, SourceDeckV1 } from '@lolly-tools/core/rebrand-v1';
import { STARTER_COLORS, runRebrandPipeline, type RebrandRunV1 } from '../../../../../tests/helpers/rebrand-pipeline.ts';
import type {
  RebrandControllerV1,
  RebrandDecideInputV1,
  RebrandEditOutcomeV1,
  RebrandOpenOutcomeV1,
  RebrandPresetSummaryV1,
  RebrandProjectSummaryV1,
  RebrandStateV1,
} from '../../lib/rebrand/controller-api.ts';
import type { RbCtx } from './context.ts';

type ControllerV1 = RebrandControllerV1;
type StateV1 = RebrandStateV1;
type SummaryV1 = RebrandProjectSummaryV1;
type OpenOutcomeV1 = RebrandOpenOutcomeV1;
type EditOutcomeV1 = RebrandEditOutcomeV1;

// ─── the stylesheets ─────────────────────────────────────────────────────────

const PARTS = new URL('../../styles/parts/', import.meta.url);

/** Every `styles/parts/rebrand*.css`, in name order, joined into one text. */
export function rebrandCss(): string {
  return readdirSync(PARTS)
    .filter((name) => /^rebrand(?:-[a-z]+)?\.css$/.test(name))
    .sort()
    .map((name) => readFileSync(new URL(name, PARTS), 'utf8'))
    .join('\n');
}

// ─── markup ──────────────────────────────────────────────────────────────────

/**
 * Put fixed markup in `host`, parsed by the suite's own DOM rather than assigned, so
 * test support code stays out of the app's inventory of raw HTML sinks.
 */
export function setMarkup(host: Element, html: string): void {
  const parsed = new DOMParser().parseFromString(`<!DOCTYPE html><body>${html}</body>`, 'text/html');
  host.replaceChildren(...[...parsed.body.childNodes].map((node) => document.importNode(node, true)));
}

// ─── the review harness ──────────────────────────────────────────────────────

const REVIEW_FIXTURE = new URL('../../../../../tests/fixtures/rebrand/adversarial.pptx', import.meta.url);
let reviewRun: Promise<RebrandRunV1> | undefined;

export interface StubCall {
  name: string;
  args: unknown[];
}

export interface ReviewMounted {
  rb: RbCtx;
  calls: StubCall[];
  said: string[];
  unmount: () => void;
}

/** The review surface's helpers over one shared run of the adversarial deck. */
export async function reviewHarness() {
  // The modules read the DOM globals the suite installed, so they load after them.
  const { deriveReview } = await import('./shared.ts');
  const { queueOps } = await import('./queue.ts');
  const { reviewItems, toReviewCount } = await import('./foot.ts');
  const { compareOps } = await import('./compare.ts');
  const { decideOps } = await import('./decide.ts');
  const { stripOps } = await import('./strip.ts');
  const { keysOps } = await import('./keys.ts');
  // Plan 275's stub namespaces, wired the way the orchestrator wires them.
  const { chooserOps } = await import('./layout-chooser.ts');
  const { dragOps } = await import('./strip-drag.ts');
  const { themeOps } = await import('./theme.ts');
  const { columnsOps } = await import('./columns.ts');

  /** One real run, shared by every test: the pipeline is the slow part. */
  reviewRun ??= runRebrandPipeline('adversarial.pptx', new Uint8Array(readFileSync(REVIEW_FIXTURE)));
  const RUN: RebrandRunV1 = await reviewRun;

  /** The mark group the first pass proposes to replace: three members on three slides. */
  const MARK_GROUP = reviewQueue(RUN.plan, RUN.census, RUN.deck).find((item) => item.class === 'logo-candidate' && item.objectIds.length > 1);
  assert.ok(MARK_GROUP, 'the adversarial deck has a mark group');

  /** The plan with one mark, not the exemplar, locked by a person. */
  function planWithLockedMark(): { plan: RenovationPlanV1; lockedId: string } {
    const group = MARK_GROUP;
    assert.ok(group);
    const lockedId = group.objectIds.find((id) => id !== group.exemplar);
    assert.ok(lockedId);
    const plan: RenovationPlanV1 = {
      ...RUN.plan,
      slides: RUN.plan.slides.map((slide) => ({
        ...slide,
        objects: slide.objects.map((row) => (row.id === lockedId ? { ...row, locked: true } : row)),
      })),
    };
    return { plan, lockedId };
  }

  function stateFrom(plan: RenovationPlanV1 = RUN.plan, extra: Partial<RebrandStateV1> = {}): RebrandStateV1 {
    return {
      phase: 'review',
      mode: 'renovate',
      progress: null,
      error: null,
      project: null,
      source: RUN.deck,
      census: RUN.census,
      plan,
      faithful: compileFaithful(RUN.deck),
      preview: { deck: RUN.compiled, planRevision: plan.revision },
      previewStale: false,
      designSystem: {
        id: 'lolly/start',
        name: 'Lolly start',
        neutralMaster: false,
        hasLogo: true,
        archetypes: [...ARCHETYPE_IDS],
        colors: Object.fromEntries(STARTER_COLORS),
        fonts: ['SUSE'],
      },
      save: { kind: 'none' },
      history: { canUndo: true, canRedo: true },
      keep: { status: 'idle' },
      readiness: [],
      tick: 1,
      ...extra,
    };
  }

  const OK: RebrandEditOutcomeV1 = { ok: true, touched: 1, skipped: 0 };

  /** A controller that records every command and answers ok. */
  function stubController(state: RebrandStateV1, calls: StubCall[]): RebrandControllerV1 {
    const record = (name: string) => async (...args: unknown[]): Promise<RebrandEditOutcomeV1> => {
      calls.push({ name, args });
      return OK;
    };
    return {
      getState: () => state,
      subscribe: () => () => {},
      start: async () => {},
      open: async () => {},
      recent: async () => [],
      remove: async () => {},
      close: () => {},
      decide: async (input: RebrandDecideInputV1) => {
        calls.push({ name: 'decide', args: [input] });
        return { ok: true, touched: input.objectIds.length, skipped: 0 };
      },
      acceptSuggestions: record('acceptSuggestions'),
      include: record('include'),
      move: record('move'),
      setLayout: record('setLayout'),
      moveTo: record('moveTo'),
      moveSlides: record('moveSlides'),
      duplicateSlide: record('duplicateSlide'),
      resetSlide: record('resetSlide'),
      setTheme: record('setTheme'),
      setGround: record('setGround'),
      readSlidePictures: record('readSlidePictures'),
      setColour: record('setColour'),
      setFont: record('setFont'),
      shuffleColours: record('shuffleColours'),
      undo: record('undo'),
      redo: record('redo'),
      openInDesign: async () => ({ ok: false, reason: 'no-plan', warnings: [] }),
      downloadProject: async () => null,
      setMode: async () => {},
      keepDesignDownload: async () => null,
      mediaHref: () => undefined,
      cancel: () => {},
      reload: async () => {},
      dispose: () => {},
    };
  }

  /** A small stand-in for the orchestrator: the regions, the context, the five review modules. */
  function mount(state: RebrandStateV1, opts: { narrow?: boolean } = {}): ReviewMounted {
    setMarkup(document.body, `<div id="view"><div class="rb">
      <header class="rb-top"><div class="rb-mode-slot"></div></header>
      <section class="rb-intake"></section>
      <div class="rb-body"><nav class="rb-queue"></nav><div class="rb-grip" data-grip="queue" hidden></div><main class="rb-work"><section class="rb-compare"></section></main><div class="rb-grip" data-grip="decide" hidden></div><aside class="rb-decide"></aside></div>
      <nav class="rb-strip"></nav><aside class="rb-report" hidden></aside><footer class="rb-foot"></footer><p class="rb-status"></p>
    </div></div>`);
    const q = (selector: string): HTMLElement => {
      const el = document.querySelector<HTMLElement>(selector);
      assert.ok(el, selector);
      return el;
    };
    const calls: StubCall[] = [];
    const said: string[] = [];
    const rb = {} as RbCtx;
    rb.viewEl = q('#view');
    rb.host = {} as RbCtx['host'];
    rb.params = new URLSearchParams();
    rb.els = {
      root: q('.rb'), top: q('.rb-top'), modeSlot: q('.rb-mode-slot'), intake: q('.rb-intake'), body: q('.rb-body'),
      queue: q('.rb-queue'), queueGrip: q('.rb-grip[data-grip="queue"]'), compare: q('.rb-compare'),
      decideGrip: q('.rb-grip[data-grip="decide"]'), decide: q('.rb-decide'), strip: q('.rb-strip'),
      report: q('.rb-report'), foot: q('.rb-foot'), status: q('.rb-status'),
      alert: q('.rb'), scrim: q('.rb'),
    };
    rb.controller = stubController(state, calls);
    rb.state = state;
    rb.derived = null;
    rb.sel = { slideId: null, objectId: null, itemId: null };
    rb.queueTab = 'attention';
    rb.compareSide = 'both';
    rb.reportOpen = false;
    rb.narrow = opts.narrow === true;
    rb.medium = false;
    rb.memo = {};
    rb.disposers = [];
    rb.render = () => {
      rb.derived = deriveReview(rb.state, rb.derived);
      const derived = rb.derived;
      if (!derived) return;
      if (!rb.sel.slideId) {
        const first = derived.queue.find((item) => item.section === 'attention');
        rb.sel = first
          ? { itemId: first.id, objectId: first.exemplar, slideId: derived.objects.get(first.exemplar)?.slideId ?? null }
          : { itemId: null, objectId: null, slideId: derived.slides[0]?.id ?? null };
      }
      rb.queue.render();
      rb.compare.render();
      rb.decide.render();
      rb.strip.render();
    };
    rb.select = (next) => {
      rb.sel = { ...rb.sel, ...next };
      rb.render();
      if (rb.sel.slideId) rb.strip.reveal(rb.sel.slideId);
    };
    rb.announce = (message) => { said.push(message); };
    rb.intake = { wire() {}, render() {} } as RbCtx['intake'];
    rb.top = {
      wire() {},
      render() {},
      download: async () => {},
      close() {},
      menuOpen: () => false,
      stepDone: (direction: 'undo' | 'redo') => (direction === 'undo' ? 'Undone.' : 'Redone.'),
    } as RbCtx['top'];
    rb.foot = {
      wire() {},
      render() {},
      toReviewCount: () => toReviewCount(rb),
      reviewItems: () => reviewItems(rb),
      say: (message: string) => { said.push(message); },
    } as RbCtx['foot'];
    rb.keep = { wire() {}, render() {} } as RbCtx['keep'];
    rb.report = {
      wire() {},
      render() {},
      open() { rb.reportOpen = true; },
      close() { rb.reportOpen = false; },
    } as RbCtx['report'];
    rb.queue = queueOps(rb);
    rb.compare = compareOps(rb);
    rb.decide = decideOps(rb);
    rb.strip = stripOps(rb);
    rb.keys = keysOps(rb);
    rb.chooser = chooserOps(rb);
    rb.drag = dragOps(rb);
    rb.theme = themeOps(rb);
    rb.columns = columnsOps(rb);
    rb.queue.wire();
    rb.compare.wire();
    rb.decide.wire();
    rb.strip.wire();
    rb.keys.wire();
    rb.render();
    return {
      rb,
      calls,
      said,
      unmount: () => { for (const dispose of rb.disposers.splice(0)) dispose(); },
    };
  }

  /** Let the awaited controller call and the redraw after it finish. */
  const settle = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });

  function change(el: HTMLElement): void {
    el.dispatchEvent(new window.Event('change', { bubbles: true }));
  }

  function keydown(key: string, init: KeyboardEventInit = {}): void {
    document.body.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
  }

  /** Every object on the first slide with its source slide. */
  function firstSlide(): (typeof RUN.deck.slides)[number] {
    const slide = RUN.deck.slides[0];
    assert.ok(slide);
    return slide;
  }

  /**
   * The compiled deck with one continuation frame after slide 1 and the given slide 1
   * objects in the tray, built here so the test does not hang on how many objects the
   * current compile rules happen to send where.
   */
  function deckWithSurplus(unplaced: string[]): RebrandStateV1['preview'] {
    const deck = structuredClone(RUN.compiled);
    const slide = firstSlide();
    const main = deck.frames.find((frame) => frame.sourceSlideId === slide.id);
    assert.ok(main);
    const more = { ...structuredClone(main), id: `${main.id}.c1`, continuation: true, layers: main.layers.map((row) => ({ ...row, id: `${String(row.id)}.c1` })) };
    deck.frames.splice(deck.frames.indexOf(main) + 1, 0, more);
    deck.tray = unplaced.map((id) => ({ sourceObjectId: id, layer: { id: `tray.${id}`, kind: 'text', x: 0, y: 0, w: 100, h: 20, text: 'x' } }));
    return { deck, planRevision: RUN.plan.revision };
  }

  /** The deck with its first slide rebuilt from a picture: flattened, with the picture kept as recovery. */
  function pictureDeckState(): { state: RebrandStateV1; ref: string; slideId: string } {
    const deck = structuredClone(RUN.deck);
    const slide = deck.slides[0];
    assert.ok(slide);
    const ref = 'user/media/slide-1-picture';
    slide.origin = { ...slide.origin, flattened: true };
    slide.recovery = { assetRef: ref, fromObjectId: `${slide.id}.picture` };
    return { state: stateFrom(RUN.plan, { source: deck }), ref, slideId: slide.id };
  }

  return {
    RUN, MARK_GROUP, planWithLockedMark, stateFrom, mount, settle, change, keydown,
    firstSlide, deckWithSurplus, pictureDeckState, toReviewCount,
  };
}

// ─── the frame harness ───────────────────────────────────────────────────────

const REPO = new URL('../../../../../', import.meta.url);
export const sample = <T,>(name: string): T =>
  JSON.parse(readFileSync(new URL(`tests/fixtures/rebrand/samples/${name}`, REPO), 'utf8')) as T;

export const source = sample<SourceDeckV1>('source.json');
export const census = sample<DeckCensusV1>('census.json');
export const plan = sample<RenovationPlanV1>('plan.json');
export const project = sample<RenovationProjectV1>('project.json');

export function idleState(): StateV1 {
  return {
    phase: 'idle',
    mode: 'renovate',
    progress: null,
    error: null,
    project: null,
    source: null,
    census: null,
    plan: null,
    faithful: null,
    preview: null,
    previewStale: false,
    designSystem: null,
    save: { kind: 'none' },
    history: { canUndo: false, canRedo: false },
    keep: { status: 'idle' },
    readiness: [],
    tick: 0,
  };
}

export function reviewState(over: Partial<StateV1> = {}): StateV1 {
  return {
    ...idleState(),
    phase: 'review',
    project,
    source,
    census,
    plan,
    designSystem: {
      id: 'lolly-start',
      name: 'Lolly Start',
      neutralMaster: true,
      hasLogo: true,
      archetypes: ['title', 'content'],
      colors: {},
      fonts: ['Outfit'],
    },
    save: { kind: 'saved', revision: project.revision },
    ...over,
  };
}

/** The compiled sample as the preview for `revision`, so the Proposed pane is current. */
export function previewFor(revision: number): StateV1['preview'] {
  return { deck: sample<CompiledDeckV1>('compiled.json'), planRevision: revision };
}

/** The sample plan with every row answered, so nothing waits and Open in Design leads. */
export function planSettled(): RenovationPlanV1 {
  const copy = structuredClone(plan);
  for (const slide of copy.slides) {
    for (const row of slide.objects) {
      if (row.decision === undefined && row.review !== 'accepted') {
        row.decision = row.proposal;
        row.review = 'accepted';
        row.author = 'user';
      }
    }
  }
  return copy;
}

/**
 * A plan with one more suggestion waiting: a row nobody has looked at yet, beside the
 * sample's own flagged row, so two rows wait.
 */
export function planWithPending(): RenovationPlanV1 {
  const copy = structuredClone(plan);
  const row = copy.slides[1]!.objects[1]!;
  row.review = 'unreviewed';
  delete row.decision;
  delete row.locked;
  copy.revision += 1;
  return copy;
}

export class StubController implements ControllerV1 {
  state: StateV1;
  listeners = new Set<(state: StateV1) => void>();
  calls: string[] = [];
  projects: SummaryV1[] = [];
  openOutcome: OpenOutcomeV1 = { ok: true, warnings: [] };
  acceptOutcome: EditOutcomeV1 = { ok: true, touched: 1, skipped: 0 };
  constructor(state: StateV1) {
    this.state = state;
  }
  set(next: StateV1): void {
    this.state = { ...next, tick: this.state.tick + 1 };
    for (const listener of this.listeners) listener(this.state);
  }
  private edit(name: string): Promise<EditOutcomeV1> {
    this.calls.push(name);
    return Promise.resolve({ ok: true, touched: 0, skipped: 0 });
  }
  getState(): StateV1 {
    return this.state;
  }
  subscribe(listener: (state: StateV1) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  async start(file: File): Promise<void> {
    this.calls.push(`start:${file.name}`);
  }
  async open(projectId: string): Promise<void> {
    this.calls.push(`open:${projectId}`);
  }
  async recent(): Promise<SummaryV1[]> {
    return this.projects;
  }
  async remove(projectId: string): Promise<void> {
    this.calls.push(`remove:${projectId}`);
  }
  close(): void {
    this.calls.push('close');
  }
  decide() {
    return this.edit('decide');
  }
  async acceptSuggestions(): Promise<EditOutcomeV1> {
    this.calls.push('accept');
    return this.acceptOutcome;
  }
  include() {
    return this.edit('include');
  }
  move() {
    return this.edit('move');
  }
  setLayout() {
    return this.edit('layout');
  }
  setColour() {
    return this.edit('colour');
  }
  setFont() {
    return this.edit('font');
  }
  shuffleColours() {
    return this.edit('shuffle');
  }
  undo() {
    return this.edit('undo');
  }
  redo() {
    return this.edit('redo');
  }
  async openInDesign(): Promise<OpenOutcomeV1> {
    this.calls.push('openInDesign');
    return this.openOutcome;
  }
  async downloadProject() {
    return null;
  }
  async setMode(mode: StateV1['mode']): Promise<void> {
    this.calls.push(`mode:${mode}`);
  }
  async keepDesignDownload() {
    return null;
  }
  mediaHref(): string | undefined {
    return undefined;
  }
  cancel(): void {
    this.calls.push('cancel');
  }
  async reload(): Promise<void> {
    this.calls.push('reload');
  }
  dispose(): void {}
  presetList: RebrandPresetSummaryV1[] = [];
  async startMany(files: File[]): Promise<void> {
    this.calls.push(`startMany:${files.map((file) => file.name).join(',')}`);
  }
  async openNewerVersion(file: File): Promise<void> {
    this.calls.push(`newer:${file.name}`);
  }
  async presets() {
    return this.presetList;
  }
  choosePreset(presetId: string | null): void {
    this.calls.push(`choosePreset:${presetId}`);
  }
  async applyPreset(presetId: string | null): Promise<EditOutcomeV1> {
    this.calls.push(`applyPreset:${presetId}`);
    return { ok: true, touched: 1, skipped: 0 };
  }
  async savePreset(name: string) {
    this.calls.push(`savePreset:${name}`);
    return { ok: true, id: 'mine/x' };
  }
  async refreshReadiness(): Promise<void> {
    this.calls.push('refreshReadiness');
  }
  picturesOutcome: EditOutcomeV1 = { ok: true, touched: 2, skipped: 0 };
  async readSlidePictures(): Promise<EditOutcomeV1> {
    this.calls.push('readSlidePictures');
    return this.picturesOutcome;
  }
}

/** The sample deck with every slide one stored picture of a slide, as a scanned PDF reads. */
export function picturesSource(): SourceDeckV1 {
  const copy = structuredClone(source);
  for (const slide of copy.slides) {
    slide.origin = { ...slide.origin, kind: 'pdf', flattened: true };
    slide.objects = [{
      id: `${slide.id}.page`,
      fingerprint: 'pic:page',
      kind: 'pic',
      box: { x: 0, y: 0, w: slide.width, h: slide.height, rot: 0 },
      origin: 'pdf-artifact',
      fidelity: { state: 'editable' },
      media: `user/upload/${slide.id}-page.png`,
    }];
  }
  return copy;
}

/** Mount the frame's four modules over a controller; see the file comment. */
export async function frameHarness() {
  // The modules read the DOM globals the suite installed, so they load after them.
  const { deriveReview } = await import('./shared.ts');
  const { intakeOps } = await import('./intake.ts');
  const { topOps } = await import('./top.ts');
  const { footOps } = await import('./foot.ts');
  const { reportOps } = await import('./report.ts');
  const { keysOps } = await import('./keys.ts');
  const { themeOps } = await import('./theme.ts');
  const { nounText } = await import('./queue.ts');
  const { compareOps } = await import('./compare.ts');
  const { chooserOps } = await import('./layout-chooser.ts');

  /** The regions `views/rebrand.ts` builds, for the four this suite draws. */
  function mount(controller: StubController): { rb: RbCtx; view: HTMLElement; announced: string[] } {
    const view = document.createElement('div');
    setMarkup(view, `
      <div class="rb">
        <header class="rb-top"><div class="rb-mode-slot"></div></header>
        <section class="rb-intake"></section>
        <section class="rb-alert" hidden></section>
        <aside class="rb-report" hidden></aside>
        <footer class="rb-foot"></footer>
        <div class="rb-scrim" hidden></div>
        <p class="rb-status" role="status"></p>
      </div>`);
    document.body.replaceChildren(view);
    const q = (selector: string): HTMLElement => view.querySelector<HTMLElement>(selector)!;
    const announced: string[] = [];
    const rb = {} as RbCtx;
    rb.viewEl = view;
    rb.params = new URLSearchParams();
    rb.els = {
      root: q('.rb'), top: q('.rb-top'), modeSlot: q('.rb-mode-slot'), intake: q('.rb-intake'),
      body: q('.rb'), queue: q('.rb'), queueGrip: q('.rb'), compare: q('.rb'), decideGrip: q('.rb'), decide: q('.rb'), strip: q('.rb'),
      report: q('.rb-report'), foot: q('.rb-foot'), status: q('.rb-status'),
      alert: q('.rb-alert'), scrim: q('.rb-scrim'),
    };
    rb.controller = controller;
    rb.state = controller.getState();
    rb.derived = null;
    rb.sel = { slideId: null, objectId: null, itemId: null };
    rb.queueTab = 'attention';
    rb.compareSide = 'both';
    rb.reportOpen = false;
    rb.narrow = false;
    rb.medium = false;
    rb.memo = {};
    rb.disposers = [];
    rb.announce = (message) => void announced.push(message);
    rb.select = (next) => {
      rb.sel = { ...rb.sel, ...next };
      rb.render();
    };
    rb.render = () => {
      rb.derived = deriveReview(rb.state, rb.derived);
      rb.els.report.hidden = !rb.reportOpen;
      // The orchestrator's rule: the footer shows only once there is a plan.
      rb.els.foot.hidden = !rb.state.plan;
      rb.top.render();
      rb.intake.render();
      if (rb.derived) rb.foot.render();
      rb.report.render();
    };
    rb.intake = intakeOps(rb);
    rb.top = topOps(rb);
    rb.foot = footOps(rb);
    rb.report = reportOps(rb);
    // The report and the intake draw their pictures through the comparison's drawing
    // cache and name layouts through the chooser; neither region is mounted here.
    rb.compare = compareOps(rb);
    rb.chooser = chooserOps(rb);
    // The chooser redraws the decision column once the design system's master is read;
    // the column is not mounted here, so that redraw has nothing to draw.
    rb.decide = { render: () => {} } as RbCtx['decide'];
    // The project menu's Keyboard shortcuts row opens the filmstrip's sheet; the strip is
    // not mounted here, so the harness records the call.
    rb.strip = { shortcuts: () => void announced.push('shortcuts sheet') } as RbCtx['strip'];
    // The report names objects through the queue's noun; the queue itself is not mounted here.
    rb.queue = { noun: (...args: Parameters<typeof nounText> extends [RbCtx, ...infer R] ? R : never) => nounText(rb, ...args) } as RbCtx['queue'];
    // The top bar's Undo and Redo share the keyboard module's step; it is not wired here.
    rb.keys = keysOps(rb);
    // The top bar draws the deck theme control through the theme module, whose own
    // tests draw it; here its place in the bar is left empty.
    rb.theme = { ...themeOps(rb), renderControl: () => {} };
    rb.top.wire();
    rb.intake.wire();
    rb.report.wire();
    rb.foot.wire();
    controller.subscribe((state) => {
      rb.state = state;
      rb.render();
    });
    rb.render();
    return { rb, view, announced };
  }

  /** Let the intake's store read and the click handlers' promises settle. */
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  };

  const text = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  /** The dialog open on the page, once it is there. */
  async function openDialog(): Promise<HTMLDialogElement> {
    for (let i = 0; i < 50; i += 1) {
      const found = document.querySelector<HTMLDialogElement>('dialog[open]');
      if (found) return found;
      await settle();
    }
    throw new Error('no dialog opened');
  }

  return { mount, settle, text, openDialog };
}
