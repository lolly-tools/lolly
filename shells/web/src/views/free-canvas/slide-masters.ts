// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: slide masters (plan 274 section 3.4).
 *
 * A slide master is design-system data, not code: a catalog asset the brand pack ships
 * (`lolly/slides/masters` on the blank starter, `suse/slides/masters` in the SUSE pack)
 * holding archetypes with named placeholder roles and the master furniture each one
 * shows. This module is Design's end of it. It loads the active design system's master
 * through `host.assets`, resolves the master's logo tags to catalog asset ids and its
 * token paths to colours through `host.tokens`, and then hands both to the pure engine
 * helpers: `seedFrame` lays a new slide down, `applyArchetype` re-lays a slide into a
 * different archetype, `resetFrame` puts master geometry back without touching content.
 *
 * Every seeded layer carries `master` plus either `role` or `furniture`, and those three
 * manifest fields are what the two re-lay actions read. A layer a person drew by hand
 * carries none of them, keeps every value it had and is never re-laid. Furniture is
 * committed `locked: true`, so a stray drag cannot walk the logo off the corner.
 *
 * Two rules the re-lay path follows:
 *
 *   - **Paint order is the target archetype's own.** A master states a split panel and a
 *     caption scrim as backdrop furniture the words sit on top of, and `seedFrame` emits
 *     them in that order. Appending re-seeded furniture at the end would paint the panel
 *     over the title, so the child run is rebuilt against a fresh seed of the target and
 *     what the person added goes on top of it.
 *   - **An existing layer never takes a tool seed.** The `addKinds` seed is for a layer
 *     being created. Merging it into a layer that already exists writes Design's own
 *     defaults (a literal ink colour, a 64px size, rounded corners) over what the person
 *     or the brand token set.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling calls in
 * this file are direct; anything in another module goes through `fc.<module>.<fn>`.
 */
import {
  applyArchetype as relayoutToArchetype,
  resetFrame as relayoutToMaster,
  seedFrame,
  type LogoSetV1,
  type TokenResolver,
} from '@lolly/engine';
import type {
  ArchetypeRefV1,
  DesignBoxRowV1,
  MasterTextStyleV1,
  SlideMasterV1,
} from '@lolly-tools/core';
import { findArchetype } from '@lolly-tools/core';
import type { Box } from '../free-canvas-math.ts';
import { num } from '../free-canvas-math.ts';
import { t } from '../../i18n.ts';
import {
  MASTER_ASSET_TAGS,
  isMasterAssets,
  isMasterTokens,
  readColors,
  readMasterFile,
  resolveLogos,
  type MasterAssetsApi,
  type MasterTokensApi,
} from '../../lib/rebrand/design-system.ts';
import { buildLayoutChooser, layoutTiles } from '../../lib/slide-structures-ui.ts';
import { archetypeThumbSvg } from './archetype-thumb.ts';
import { bindOp, type FcCtx } from './context.ts';

/**
 * The four box sub-fields the master binding writes, named once here.
 *
 * Not canvas-config keys: `canvas` is a closed set in `schemas/tool.schema.json`, and
 * `notes` set the precedent for a frame field the manifest declares and every reader
 * names by its literal id.
 */
export const MASTER_FIELD = 'master';
export const ROLE_FIELD = 'role';
export const FURNITURE_FIELD = 'furniture';
export const ARCHETYPE_FIELD = 'archetype';

/**
 * Design's rectangle-shaping fields, which master furniture never inherits from a seed.
 * A colour panel, a caption scrim and a bar all run to the slide edge, so Design's own
 * rounded corner would cut the corner off the slide.
 */
const FURNITURE_SQUARE_FIELDS = ['shape', 'radius'] as const;

/**
 * The catalog query that finds a design system's slide masters, on every profile. The
 * readers live in `lib/rebrand/design-system.ts`, which the renovation journey shares.
 */
export { MASTER_ASSET_TAGS };

/** What a menu can ask before it draws a row, with no promise to await. */
export type MasterStatus = 'unknown' | 'ready' | 'none';

/**
 * The menu wording for the three slide-master actions, translated on each read.
 *
 * This module owns the actions, so the words belong here. A module that shows them
 * reads them through `fc.slideMasters.menuCopy()` rather than keeping a second copy or
 * importing this file. The ellipsis marks the two that open the
 * chooser. `noMaster` is the one sentence a disabled New slide row would explain itself
 * with: `PopAction` (views/free-canvas/shared.ts) carries a label, an icon and a disabled
 * flag and no hint of any kind, so the row is disabled and silent until that type grows
 * one, and the sentence stays pinned here in the meantime.
 */
export function slideMasterMenuCopy(): {
  newSlide: string;
  applyLayout: string;
  resetSlide: string;
  noMaster: string;
} {
  return {
    newSlide: t('New slide from layout…'),
    applyLayout: t('Apply layout…'),
    resetSlide: t('Reset slide'),
    noMaster: t('This design system has no slide master.'),
  };
}

interface MasterHost {
  assets?: MasterAssetsApi;
  tokens?: MasterTokensApi;
}

/** Everything one load resolved: the master itself, its logo ids and its colour tokens. */
export interface LoadedMaster {
  master: SlideMasterV1;
  logos: LogoSetV1<string>;
  colors: Map<string, string>;
}

/** Why a re-lay did nothing. Each one gets its own sentence rather than silence. */
export type RelayRefusal = 'no-master' | 'no-frame' | 'not-seeded' | 'other-master' | 'unknown-archetype';

/**
 * What one re-lay did. `surplus` counts role-bound layers the target archetype has no
 * slot for: the engine leaves them where they are, and this is what the caller reports.
 * `adopted` marks a slide that came from a different master and now follows the
 * active design system's.
 */
export type RelayResult =
  | { ok: true; surplus: number; adopted: boolean }
  | { ok: false; refusal: RelayRefusal };

/**
 * The two host APIs this module reads, feature-detected off free-canvas's own host.
 *
 * `HostApi` in shared.ts is the narrow view the canvas needs, so neither `query` nor
 * `tokens` is declared on it. They are read as unknown and admitted by a guard, which
 * is also what makes a host without them (the CLI, a test stub) an ordinary answer.
 */
function hostOf(fc: FcCtx): MasterHost {
  const host = fc.host as { assets?: unknown; tokens?: unknown } | null | undefined;
  const assets = host?.assets;
  const tokens = host?.tokens;
  const out: MasterHost = {};
  if (isMasterAssets(assets)) out.assets = assets;
  if (isMasterTokens(tokens)) out.tokens = tokens;
  return out;
}

/** A design-system colour token path to its hex, from the snapshot taken at load. */
function resolverFor(loaded: LoadedMaster | null): TokenResolver {
  return (path: string): string | undefined => loaded?.colors.get(path);
}

/**
 * Load the active design system's slide master once and remember the answer.
 *
 * Returns null when the design system ships none, when the host has no asset API, or
 * when the file cannot be read. Null is a fact the menus report, not an error: a pack
 * without a master is an ordinary pack.
 */
export function loadMaster(fc: FcCtx): Promise<LoadedMaster | null> {
  if (fc.slideMaster) return Promise.resolve(fc.slideMaster);
  if (fc.slideMasterLoad) return fc.slideMasterLoad;
  const assets = hostOf(fc).assets;
  if (!assets?.query) {
    fc.slideMasterStatus = 'none';
    return Promise.resolve(null);
  }
  const load = (async (): Promise<LoadedMaster | null> => {
    try {
      const master = await readMasterFile(assets);
      if (!master) {
        fc.slideMasterStatus = 'none';
        return null;
      }
      const [logos, colors] = await Promise.all([resolveLogos(assets, master), readColors(hostOf(fc).tokens)]);
      const loaded: LoadedMaster = { master, logos, colors };
      fc.slideMaster = loaded;
      fc.slideMasterStatus = 'ready';
      return loaded;
    } catch {
      fc.slideMasterStatus = 'none';
      return null;
    } finally {
      fc.slideMasterLoad = null;
    }
  })();
  fc.slideMasterLoad = load;
  return load;
}

/**
 * Forget the loaded master, so the next read goes back to the catalog.
 *
 * The master, its logo ids and its colour snapshot belong to one design system. Nothing
 * in free-canvas is told when the active one changes today, so this is the single call a
 * future design-system signal makes. See the open issue on scoping the catalog query.
 */
export function bustSlideMaster(fc: FcCtx): void {
  fc.slideMaster = null;
  fc.slideMasterLoad = null;
  fc.slideMasterStatus = 'unknown';
}

/** What the menus may state without waiting: ready, none, or not looked yet. */
export function masterStatus(fc: FcCtx): MasterStatus {
  if (fc.slideMaster) return 'ready';
  return fc.slideMasterStatus ?? 'unknown';
}

/**
 * The layouts this design system's master offers, in the layout library's order, each
 * named the way the Rebrand chooser names it (`lib/slide-structures-ui.ts`). A dark
 * variant is not listed: a slide reaches it through its background. A mirrored pair is
 * one choice here, its mirror a flip on the tile.
 */
export function archetypeChoices(fc: FcCtx): Array<{ id: ArchetypeRefV1; label: string }> {
  const master = fc.slideMaster?.master;
  if (!master) return [];
  return layoutTiles(master).map((tile) => ({ id: tile.id, label: tile.name }));
}

// ── size ─────────────────────────────────────────────────────────────────────

/**
 * The master restated at one page size.
 *
 * Every master box is a fraction, so one master serves 1280x720, 1920x1080 and a print
 * page. The type scale is the one place a pixel appears, so it moves by the same factor,
 * and the smaller of the two axes decides it, which keeps a title inside a page that got
 * wider without getting taller. A size equal to the master's own returns the master
 * itself, so the common case allocates nothing.
 */
function sizedMaster(master: SlideMasterV1, width: number, height: number): SlideMasterV1 {
  const w = Math.round(width);
  const h = Math.round(height);
  if (!(w > 0) || !(h > 0)) return master;
  if (w === master.size.width && h === master.size.height) return master;
  const k = Math.min(w / master.size.width, h / master.size.height);
  if (!Number.isFinite(k) || k <= 0) return master;
  const px = (n: number): number => Math.max(1, Math.round(n * k));
  const scaled = (style: MasterTextStyleV1 | undefined): MasterTextStyleV1 | undefined =>
    style && typeof style.fontSize === 'number' ? { ...style, fontSize: px(style.fontSize) } : style;
  const scale = master.typeScale;
  return {
    ...master,
    size: { width: w, height: h },
    typeScale: {
      title: px(scale.title),
      subtitle: px(scale.subtitle),
      body: px(scale.body),
      caption: px(scale.caption),
      number: px(scale.number),
      label: px(scale.label),
    },
    archetypes: master.archetypes.map((a) => ({
      ...a,
      placeholders: a.placeholders.map((p) => (p.style ? { ...p, style: scaled(p.style) } : p)),
    })),
    furniture: master.furniture.map((f) => (f.style ? { ...f, style: scaled(f.style) } : f)),
  };
}

/** The page size a new slide takes: the frames already on the canvas, else the document's. */
function slideSize(fc: FcCtx, boxes: Box[]): { w: number; h: number } {
  const { cfg, frameCfg } = fc;
  if (frameCfg) {
    for (const b of boxes) {
      if (b == null || String(b[cfg.kindField]) !== frameCfg.frameKind) continue;
      const w = num(b[cfg.wField]);
      const h = num(b[cfg.hField]);
      if (w > 0 && h > 0) return { w, h };
    }
  }
  const d = fc.helpers.canvasWH();
  return { w: d.w, h: d.h };
}

// ── rows ─────────────────────────────────────────────────────────────────────

/** A Design box as the engine's row type. Values the engine cannot carry are dropped. */
function toRow(box: Box): DesignBoxRowV1 {
  const out: DesignBoxRowV1 = {};
  for (const [key, value] of Object.entries(box)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
      out[key] = value;
    }
  }
  return out;
}

/** The `addKinds` seed for an engine layer kind, so a seeded layer carries tool defaults. */
function seedFor(fc: FcCtx, kind: string): Box {
  const { addKinds, cfg } = fc;
  const list = Array.isArray(addKinds) ? addKinds : [];
  const hit = list.find((k) => k.seed != null && String(k.seed[cfg.kindField]) === kind);
  return { ...(hit?.seed ?? {}) };
}

/** `order` is a frame field in this manifest, and furniture is committed locked. */
function finishLayer(fc: FcCtx, box: Box, row: DesignBoxRowV1, isFrame: boolean): Box {
  if (!isFrame && fc.frameCfg?.orderField) delete box[fc.frameCfg.orderField];
  if (!isFrame && row[FURNITURE_FIELD] && fc.frameCfg?.lockedField) box[fc.frameCfg.lockedField] = true;
  return box;
}

/**
 * A NEW engine row as a Design box: the tool's own seed for that kind underneath, so a
 * seeded text layer inherits Design's line height, and the master's own geometry, colour
 * and binding on top. Master furniture drops the seed's rectangle shaping, because a
 * backdrop panel is drawn to the slide edge. `order` is a FRAME field in this manifest
 * (the page number of a slide), so a child layer never carries one: paint order is array
 * order, and the engine already returns the layers in it.
 */
function toBox(fc: FcCtx, row: DesignBoxRowV1, isFrame: boolean): Box {
  const kind = String(row[fc.cfg.kindField] ?? '');
  const box: Box = { ...seedFor(fc, kind), ...row };
  if (row[FURNITURE_FIELD]) {
    for (const field of FURNITURE_SQUARE_FIELDS) if (!(field in row)) delete box[field];
  }
  return finishLayer(fc, box, row, isFrame);
}

/**
 * A RE-LAID engine row back as a Design box, with no seed anywhere near it.
 *
 * The layer already exists, so the only values that come from outside the engine's row
 * are the ones `toRow` could not carry across (arrays and nested objects). A style field
 * the engine dropped stays dropped, which is how the target archetype's type wins over
 * the previous one's rather than the old weight or colour surviving underneath.
 */
function relayBox(fc: FcCtx, original: Box, row: DesignBoxRowV1): Box {
  const box: Box = {};
  for (const [key, value] of Object.entries(original)) {
    const carried =
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean';
    if (!carried) box[key] = value;
  }
  Object.assign(box, row);
  return finishLayer(fc, box, row, false);
}

/**
 * The slot a layer claims, for matching a re-laid layer to a freshly seeded one when the
 * ids do not line up (a frame some other surface seeded, with its own id spelling).
 * Furniture is named; a role takes the next slot of its own name in array order.
 */
function bindingKey(row: DesignBoxRowV1, seen: Map<string, number>): string {
  const furniture = String(row[FURNITURE_FIELD] ?? '');
  if (furniture) return `f:${furniture}`;
  const role = String(row[ROLE_FIELD] ?? '');
  if (!role) return '';
  const n = (seen.get(role) ?? 0) + 1;
  seen.set(role, n);
  return `r:${role}#${n}`;
}

/** Where a new slide goes: clear to the right of every frame already on the canvas. */
function nextSlideX(fc: FcCtx, boxes: Box[], width: number): number {
  const { cfg, frameCfg } = fc;
  if (!frameCfg) return 0;
  const frames = boxes.filter((b) => b != null && String(b[cfg.kindField]) === frameCfg.frameKind);
  if (!frames.length) return 0;
  const right = frames.reduce((m, b) => Math.max(m, num(b[cfg.xField]) + num(b[cfg.wField])), 0);
  return right + Math.max(40, Math.round(width * 0.08));
}

// ── the three actions ────────────────────────────────────────────────────────

/**
 * Lay a new slide down at the end of the artboard row, seeded from one archetype.
 *
 * The slide takes the page size the document already uses, so an archetype slide is the
 * same size as one Add artboard makes and a deck does not export against two page sizes.
 * One commit, so one undo step puts the whole slide back. Returns the new frame's id, or
 * null when the design system ships no master or the archetype is not in it.
 */
export async function newSlideFromArchetype(fc: FcCtx, archetypeId: ArchetypeRefV1): Promise<string | null> {
  const { frameCfg } = fc;
  if (!frameCfg) return null;
  const loaded = await loadMaster(fc);
  if (!loaded || fc.disposed) return null;
  const boxes = fc.select.getBoxes();
  const size = slideSize(fc, boxes);
  const master = sizedMaster(loaded.master, size.w, size.h);
  const frameId = fc.select.freshId(boxes);
  const seeded = seedFrame(master, archetypeId, {
    frameId,
    x: nextSlideX(fc, boxes, master.size.width),
    y: 0,
    idPrefix: frameId,
    resolveToken: resolverFor(loaded),
    logos: loaded.logos,
  });
  if (!seeded) return null;
  const frame = toBox(fc, seeded.frame, true);
  const layers = seeded.layers.map((row) => toBox(fc, row, false));
  const made = fc.document.withNewFrameOrder(boxes, frame);
  fc.selection = new Set([frameId]);
  fc.select.commit([...made.boxes, made.box, ...layers]);
  fc.chromeSync.renderChrome();
  return frameId;
}

/** An archetype id read off a box, when the master carries it: one of the twelve or a library layout. */
function archetypeIdOf(master: SlideMasterV1, value: string): ArchetypeRefV1 | undefined {
  return value ? findArchetype(master, value)?.id : undefined;
}

/** The index of a frame row by id, or -1. */
function frameIndex(fc: FcCtx, boxes: Box[], frameId: string): number {
  const { cfg, frameCfg } = fc;
  if (!frameCfg) return -1;
  return boxes.findIndex(
    (b, i) => b != null && String(b[cfg.kindField]) === frameCfg.frameKind && fc.select.idOf(b, i) === frameId
  );
}

/**
 * Re-lay one frame's bound layers into an archetype of the same master.
 *
 * Role-bound layers take the target archetype's geometry and type style and keep their
 * content; furniture goes back where the master states it; a layer with neither binding
 * keeps every value it had, so the drawing a person added to the slide stays as drawn.
 * Furniture the target does not show is dropped, furniture and placeholder slots it adds
 * are seeded empty, and the frame's own background and `archetype` field follow the
 * target. A role the target has fewer slots for keeps its layers and is counted as
 * surplus, so the caller can report it rather than leaving a stale layer unexplained.
 *
 * The child run comes out in the target archetype's own paint order, matched to a fresh
 * seed of it, so applying an archetype and seeding it give the same order. What the
 * person added and what the target has no slot for follow that run, which puts a drawing
 * over the master rather than under it.
 *
 * `toArchetypeId` equal to the frame's own archetype is Reset slide, and it goes through
 * the engine's `resetFrame` for that reason.
 */
export async function applyArchetypeToFrame(
  fc: FcCtx,
  frameId: string,
  toArchetypeId: ArchetypeRefV1,
  opts: { sameMasterOnly?: boolean } = {}
): Promise<RelayResult> {
  const { cfg, frameCfg } = fc;
  if (!frameCfg) return { ok: false, refusal: 'no-master' };
  const loaded = await loadMaster(fc);
  if (!loaded || fc.disposed) return { ok: false, refusal: 'no-master' };

  const boxes = fc.select.getBoxes();
  const fi = frameIndex(fc, boxes, frameId);
  if (fi < 0) return { ok: false, refusal: 'no-frame' };
  const frameRow = boxes[fi];
  if (!frameRow) return { ok: false, refusal: 'no-frame' };
  const boundMaster = String(frameRow[MASTER_FIELD] ?? '');
  const fromName = String(frameRow[ARCHETYPE_FIELD] ?? '');
  if (!boundMaster || !fromName) return { ok: false, refusal: 'not-seeded' };
  const fromId = archetypeIdOf(loaded.master, fromName);
  if (!fromId) return { ok: false, refusal: 'unknown-archetype' };
  const adopted = boundMaster !== loaded.master.id;
  if (adopted && opts.sameMasterOnly) return { ok: false, refusal: 'other-master' };

  // The frame's own size is what the fractions resolve against, so a slide a person
  // resized by hand is re-laid to its own edges and not to the master's reference page.
  const master = sizedMaster(loaded.master, num(frameRow[cfg.wField]), num(frameRow[cfg.hField]));
  const target = findArchetype(master, toArchetypeId);
  const from = findArchetype(master, fromId);
  if (!target || !from) return { ok: false, refusal: 'unknown-archetype' };

  const childIdx: number[] = [];
  const childBoxes: Box[] = [];
  boxes.forEach((b, i) => {
    if (b != null && i !== fi && String(b[frameCfg.frameField] ?? '') === frameId) {
      childIdx.push(i);
      childBoxes.push(b);
    }
  });
  const children = childBoxes.map(toRow);
  const origin = {
    x: num(frameRow[cfg.xField]),
    y: num(frameRow[cfg.yField]),
    resolveToken: resolverFor(loaded),
    logos: loaded.logos,
  };
  const relaid =
    fromId === toArchetypeId
      ? relayoutToMaster(master, fromId, children, origin)
      : relayoutToArchetype(master, fromId, toArchetypeId, children, origin);

  // Furniture is per archetype: the target's list decides which pieces stay.
  const wanted = new Set(target.furniture ?? []);
  const seenKept = new Map<string, number>();
  const kept: Array<{ id: string; key: string; box: Box; bound: boolean }> = [];
  relaid.forEach((row, i) => {
    const original = childBoxes[i];
    if (!original) return;
    const furniture = String(row[FURNITURE_FIELD] ?? '');
    if (furniture && !wanted.has(furniture)) return;
    kept.push({
      id: String(original[cfg.idField] ?? ''),
      key: bindingKey(row, seenKept),
      box: relayBox(fc, original, row),
      bound: Boolean(furniture || row[ROLE_FIELD]),
    });
  });

  // A throwaway seed of the target at the same origin: it states the paint order and it
  // mints the pieces this slide never had, with the id spelling seeding would have used.
  const reseeded = seedFrame(master, toArchetypeId, {
    frameId,
    x: origin.x,
    y: origin.y,
    idPrefix: frameId,
    resolveToken: origin.resolveToken,
    logos: loaded.logos,
  });

  const byId = new Map<string, number>();
  const byKey = new Map<string, number>();
  kept.forEach((k, i) => {
    if (k.id && !byId.has(k.id)) byId.set(k.id, i);
    if (k.key && !byKey.has(k.key)) byKey.set(k.key, i);
  });
  const taken = new Set<number>();
  const seenSeeded = new Map<string, number>();
  const run: Box[] = [];
  for (const row of reseeded?.layers ?? []) {
    const key = bindingKey(row, seenSeeded);
    const byIdHit = byId.get(String(row[cfg.idField] ?? ''));
    const at = byIdHit !== undefined && !taken.has(byIdHit) ? byIdHit : byKey.get(key);
    const hit = at === undefined || taken.has(at) ? undefined : kept[at];
    if (at !== undefined && hit) {
      taken.add(at);
      run.push(hit.box);
      continue;
    }
    run.push(toBox(fc, row, false));
  }
  let surplus = 0;
  kept.forEach((k, i) => {
    if (taken.has(i)) return;
    if (k.bound) surplus += 1;
    run.push(k.box);
  });

  const frame: Box = { ...frameRow, [MASTER_FIELD]: loaded.master.id, [ARCHETYPE_FIELD]: toArchetypeId };
  if (reseeded && cfg.fillField) {
    const bg = reseeded.frame[cfg.fillField];
    if (typeof bg === 'string' && bg) frame[cfg.fillField] = bg;
  }
  // The name the previous archetype minted is not a name a person typed, so it follows
  // the target; a name someone wrote stays.
  const named = fc.nameField ? String(frameRow[fc.nameField] ?? '') : '';
  if (fc.nameField && (!named || named === from.name)) frame[fc.nameField] = target.name;

  const drop = new Set(childIdx);
  const at = childIdx[0] ?? fi + 1;
  const next: Box[] = [];
  boxes.forEach((b, i) => {
    if (i === at) next.push(...run);
    if (drop.has(i)) return;
    next.push(i === fi ? frame : b);
  });
  if (at >= boxes.length) next.push(...run);
  fc.select.commit(next);
  fc.chromeSync.renderChrome();
  return { ok: true, surplus, adopted };
}

/** Reset slide: master geometry back, content kept, and only from this slide's own master. */
export async function resetFrameToMaster(fc: FcCtx, frameId: string): Promise<RelayResult> {
  const boxes = fc.select.getBoxes();
  const fi = frameIndex(fc, boxes, frameId);
  if (fi < 0) return { ok: false, refusal: 'no-frame' };
  const row = boxes[fi];
  if (!row) return { ok: false, refusal: 'no-frame' };
  const currentName = String(row[ARCHETYPE_FIELD] ?? '');
  if (!String(row[MASTER_FIELD] ?? '') || !currentName) return { ok: false, refusal: 'not-seeded' };
  const loaded = await loadMaster(fc);
  const current = loaded ? archetypeIdOf(loaded.master, currentName) : undefined;
  if (!current) return { ok: false, refusal: loaded ? 'unknown-archetype' : 'no-master' };
  return applyArchetypeToFrame(fc, frameId, current, { sameMasterOnly: true });
}

/** Is this frame bound to a master and an archetype, so the two re-lay actions apply? */
export function frameIsSeeded(fc: FcCtx, frameId: string): boolean {
  const boxes = fc.select.getBoxes();
  const fi = frameIndex(fc, boxes, frameId);
  const row = boxes[fi];
  if (!row) return false;
  return Boolean(String(row[MASTER_FIELD] ?? '') && String(row[ARCHETYPE_FIELD] ?? ''));
}

// ── what to say ──────────────────────────────────────────────────────────────

/** One short sentence per refusal, each naming the one fact the canvas does not show. */
function refusalMessage(refusal: RelayRefusal): string {
  switch (refusal) {
    case 'no-master':
      return t('This design system has no slide master.');
    case 'no-frame':
      return t('That slide is no longer on the canvas, so nothing was changed.');
    case 'not-seeded':
      return t('This slide was not made from a slide master.');
    case 'other-master':
      return t('This slide was made from a different slide master.');
    default:
      return t('This slide master has no such layout.');
  }
}

/**
 * What a finished re-lay leaves to say, or nothing when it did what it looks like.
 *
 * A re-lay that worked needs no sentence: the slide moved. The two cases below are the
 * ones the canvas alone would leave unexplained.
 */
export function relayMessage(result: RelayResult): string {
  if (!result.ok) return refusalMessage(result.refusal);
  if (result.adopted) return t('This slide now follows the active design system.');
  if (result.surplus > 0) return t('Layers this layout has no place for stayed where they were.');
  return '';
}

/** The one sentence for a re-lay that threw, rather than a closed panel and silence. */
function failedMessage(): string {
  return t('This slide could not be laid out, so nothing was changed.');
}

/** Run one re-lay and report what happened. */
function runAndReport(fc: FcCtx, work: Promise<RelayResult>): void {
  void work
    .then((result) => {
      const say = relayMessage(result);
      if (say) fc.stage.flash(say);
    })
    .catch(() => fc.stage.flash(failedMessage()));
}

// ── the picker ───────────────────────────────────────────────────────────────

/** One element with its class and, when it is given, its text. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The tile width the chooser draws its wireframes at, in px. */
export const ARCHETYPE_THUMB_WIDTH = 96;

/** One per chooser opened, so the grid can name its own head rather than repeat it. */
let archPanels = 0;

/** Where a panel opens from: the left edge and the foot of the row that was pressed. */
interface AnchorPoint {
  left: number;
  bottom: number;
}

/** The anchor's place on the screen, read while it is still in the document. */
function anchorPoint(anchor: HTMLElement): AnchorPoint {
  const r = anchor.getBoundingClientRect();
  return { left: r.left, bottom: r.bottom };
}

/** One inline length off an element's style, in px, or 0 when it is not set. */
function pxProp(node: HTMLElement, name: string): number {
  const raw = node.style.getPropertyValue(name).trim();
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Place the chooser under the row that opened it, clamped inside the stage and below
 * the top bar.
 *
 * The arithmetic is `fieldPanels.positionPanelBelow`'s, with two differences that the
 * chooser needs and the shared one cannot give it. It works from a POINT rather than a
 * live element, because the context menu row it is anchored to is gone by the time the
 * grid arrives and a detached element measures zero, which is what pinned the panel to
 * the bottom-left corner of the stage. The bottom clamp reserves the phone dock:
 * `--design-actions-h` and `--design-viewport-inset` are the two lengths
 * views/design-panels.ts writes on the stage under the compact layout, the same pair
 * `.fc-arch-panel` caps its height with, and both read 0 on a wide window. The top clamp
 * reserves the top bar, whose height views/design-topbar.ts writes on the stage as
 * `--stage-reserve-top`, so the panel never covers the bar's buttons.
 */
function placeChooser(fc: FcCtx, panel: HTMLElement, at: AnchorPoint): void {
  const { stageEl } = fc;
  const sr = stageEl.getBoundingClientRect();
  const dock = pxProp(stageEl, '--design-actions-h') + pxProp(stageEl, '--design-viewport-inset');
  const bar = pxProp(stageEl, '--stage-reserve-top');
  const room = Math.max(0, sr.height - dock);
  panel.style.left = `${Math.max(6, Math.min(at.left - sr.left, sr.width - panel.offsetWidth - 8))}px`;
  panel.style.top = `${Math.max(bar + 6, Math.min(at.bottom - sr.top + 8, room - panel.offsetHeight - 8))}px`;
}

/** Close the panel, then do the thing the tile stands for. */
function chooseArchetype(
  fc: FcCtx,
  mode: 'new' | 'apply',
  frameId: string | undefined,
  id: ArchetypeRefV1
): void {
  fc.document.closeMorePanel();
  if (mode === 'apply') {
    if (frameId) runAndReport(fc, applyArchetypeToFrame(fc, frameId, id));
    return;
  }
  void newSlideFromArchetype(fc, id)
    .then((made) => {
      // A null is a missing master OR an archetype this master does not carry, and the
      // two send a person to different places, so the answer comes from the loaded state.
      if (!made) fc.stage.flash(refusalMessage(masterStatus(fc) === 'none' ? 'no-master' : 'unknown-archetype'));
    })
    .catch(() => fc.stage.flash(failedMessage()));
}

/**
 * The archetype chooser: a grid of wireframes, one per archetype the active design
 * system's master offers, in the panel chrome the frame-state and speaker-notes panels
 * already use.
 *
 * One interaction serves both modes: a click on a tile does the thing and closes the
 * panel. The tiles are the choice, so a select-then-confirm step would add a control and a
 * press without adding information, and both actions commit once, so one undo puts either
 * back. In Apply the tile the slide already follows is marked and opens with the focus;
 * pressing it changes nothing and closes the panel, because putting master geometry back
 * is Reset slide, a named row of its own in the slide menu.
 *
 * A design system with no master gets one sentence where the grid would be. Escape and an
 * outside click close the panel through `morePanel`, the way every other one closes.
 *
 * Built as nodes rather than markup: every value here is a number or a translated string,
 * and the one that can come from a pack, an archetype name, is set as text.
 */
export function openArchetypePanel(
  fc: FcCtx,
  anchor: HTMLElement,
  mode: 'new' | 'apply',
  frameId?: string
): void {
  const { stageEl } = fc;
  // Read before anything closes: the anchor is the menu row that was pressed, and that
  // row is removed the moment this returns.
  const at = anchorPoint(anchor);
  fc.document.closeMorePanel();
  const panel = el('div', 'fc-panel fc-arch-panel');
  const head = mode === 'new' ? t('New slide') : t('Apply layout');
  const headEl = el('div', 'fc-panel-head', head);
  headEl.id = `fc-arch-head-${++archPanels}`;
  panel.append(headEl);
  const body = el('div', 'fc-arch-body');
  panel.append(body);
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());
  stageEl.appendChild(panel);
  fc.morePanel = panel;
  placeChooser(fc, panel, at);

  void (async () => {
    const loaded = await loadMaster(fc);
    if (!body.isConnected) return;
    if (!loaded) {
      body.append(el('p', 'arch-empty', refusalMessage('no-master')));
      placeChooser(fc, panel, at);
      return;
    }
    const current = mode === 'apply' && frameId ? currentArchetype(fc, frameId) : '';
    // The grid is the one Rebrand shows (lib/slide-structures-ui.ts): the master's own
    // layouts, in bands once there are enough of them, searchable, a mirrored pair as one
    // tile with a flip. One Tab stop, which opens on the layout the slide follows.
    const chooser = buildLayoutChooser({
      master: loaded.master,
      draw: archetypeThumbSvg,
      current: mode === 'apply' ? current : '',
      labelledBy: headEl.id,
      keyPrefix: 'fc-arch',
      width: ARCHETYPE_THUMB_WIDTH,
      onPick: (picked) => {
        // The layout this slide already follows is not a second Reset slide: pressing
        // it closes the chooser and leaves the slide where the person put it.
        if (mode === 'apply' && picked === current) {
          fc.document.closeMorePanel();
          return;
        }
        chooseArchetype(fc, mode, frameId, picked);
      },
    });
    body.append(chooser.root);
    // The panel was empty when it was first placed, so it is placed again now it holds
    // the grid: the clamp that keeps it on the stage reads its height.
    placeChooser(fc, panel, at);
    chooser.focusStart();
  })();
}

/** The archetype a frame is bound to, or '' when it was not seeded from a master. */
export function currentArchetype(fc: FcCtx, frameId: string): string {
  const boxes = fc.select.getBoxes();
  const fi = frameIndex(fc, boxes, frameId);
  return String(boxes[fi]?.[ARCHETYPE_FIELD] ?? '');
}

/** Reset slide, with the one sentence a person needs when the reset cannot happen. */
export function resetSlide(fc: FcCtx, frameId: string): void {
  runAndReport(fc, resetFrameToMaster(fc, frameId));
}

/** Start the load in the background, so a menu opened later can state what it knows. */
export function wireSlideMasters(fc: FcCtx): void {
  bustSlideMaster(fc);
  if (!fc.frameCfg) {
    fc.slideMasterStatus = 'none';
    return;
  }
  void loadMaster(fc).catch(() => undefined);
}

export function slideMastersOps(fc: FcCtx) {
  return {
    // Copy with no context of its own: another module reads it as
    // `fc.slideMasters.menuCopy()`, never by importing this file.
    menuCopy: slideMasterMenuCopy,
    loadMaster: bindOp(fc, loadMaster),
    bustSlideMaster: bindOp(fc, bustSlideMaster),
    masterStatus: bindOp(fc, masterStatus),
    archetypeChoices: bindOp(fc, archetypeChoices),
    newSlideFromArchetype: bindOp(fc, newSlideFromArchetype),
    applyArchetypeToFrame: bindOp(fc, applyArchetypeToFrame),
    resetFrameToMaster: bindOp(fc, resetFrameToMaster),
    frameIsSeeded: bindOp(fc, frameIsSeeded),
    currentArchetype: bindOp(fc, currentArchetype),
    openArchetypePanel: bindOp(fc, openArchetypePanel),
    resetSlide: bindOp(fc, resetSlide),
    wireSlideMasters: bindOp(fc, wireSlideMasters),
  };
}
