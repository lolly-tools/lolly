// SPDX-License-Identifier: MPL-2.0
/**
 * Colour assignment by use, with feasibility (plan 274 section 3.3).
 *
 * `mapPaletteToBrand` collapses near duplicate sources onto one target, which
 * turns a four series legend into one colour. This module replaces that path
 * for renovation: the key is a USE id from the census (this hex as body ink, as
 * a ground, as series 3 of one chart), never a bare hex, so the same hex can
 * take three different targets and two unrelated uses may share one.
 *
 * The order of work:
 *
 *   1. A use the source named by a theme slot takes the design system's colour
 *      for that slot as its FIRST candidate, which carries the author's intent
 *      across without a colour comparison. It is a candidate, not a pin: when
 *      the slot colour cannot meet a contrast pair or keep a distinction set
 *      apart, the solver moves on to the use's other candidates, the ones its
 *      role gives it. Only a person's lock is fixed.
 *   2. Candidates come from `nearestBrandColor` in `brand-map.ts`, called
 *      repeatedly over a shrinking pool, so its chroma gate and role hint are
 *      the scorer here as well. At most `MAX_CANDIDATES` per use.
 *   3. Uses tied by a distinction set or a contrast pair form one component,
 *      and each component is solved by backtracking under a node budget. A
 *      distinction set keeps its members apart by `minSeparation` in OKLab; a
 *      contrast pair is measured with `contrastRatio` on the actual pair. A
 *      search that stops on its budget has proved nothing, so it is asked again
 *      with each slot colour last before a contrast pair is relaxed.
 *   4. A component with no solution returns `unresolved` with the reason on the
 *      mappings it could not answer, and no `to`. Fewer usable colours than a
 *      distinction set needs is the correct answer, not a reason to cluster.
 *      That answer reaches that set's own members and nobody else: the rest of
 *      the component is solved without them, and every use comes back with
 *      either a target or a reason.
 *
 * Shuffle is this same solver with the candidate lists reordered from a stored
 * seed, so an alternative is reproducible rather than random.
 *
 * `affects` lists only objects an assignment can reach. A picture keeps its own
 * pixels, so a raster object id is never in that list; a slide's own ground has
 * no object, so it is named `<slide-id>#background`, the reserved form the
 * plan schema states.
 *
 * Pure: no DOM, no clock, no filesystem, no network, no `Math.random`. The
 * seeded generator is integer arithmetic only, so two hosts agree bit for bit.
 */

import type { ColorMappingV1, ColorUnresolvedReasonV1, ColorUseV1, ContrastPairV1 } from '@lolly-tools/core';

import { nearestBrandColor, type RoleHint } from './brand-map.ts';
import { contrastRatio } from './brand-derive.ts';
import { deltaEOk } from './color-tools.ts';
import { compareCodeUnits } from './rebrand-order.ts';

/** Identity of these rules, recorded on a plan for replay. */
export const COLOR_RULES = { name: 'rebrand-colors', version: 'colors-2026-09-24.4' } as const;

/** OKLab distance two uses in one distinction set must keep between them. */
export const DEFAULT_MIN_SEPARATION = 0.08;

/** Candidate targets considered per use. Plan 274 section 3.3 states a small set. */
export const MAX_CANDIDATES = 4;

/** Nodes one component's backtracking search may visit before it gives up. */
export const SEARCH_NODE_BUDGET = 20000;

/**
 * Searches one component may spend working out which contrast pairs to drop.
 * Dropping them one at a time costs a search per pair per round, so a component
 * holding dozens of pairs is bounded here rather than left to run.
 */
export const RELAX_TRIAL_BUDGET = 64;

/** A design-system colour: its token path, its resolved hex and the role it holds. */
export interface BrandSwatchV1 {
  path: string;
  hex: string;
  role?: 'bg' | 'ink' | 'accent' | 'neutral';
  /**
   * The surface this colour is ink for, when its token is named `on-<surface>`
   * (`primary` for `color.semantic.on-primary`). Such a colour is ink on that one
   * fill and not ordinary text ink, so its `role` is the one its chroma gives.
   */
  inkFor?: string;
}

/** A target a person pinned for one use. The solver treats it as fixed. */
export interface LockedColorV1 {
  useId: string;
  to: string;
  toPath?: string;
}

export interface AssignColorsInputV1 {
  uses: ColorUseV1[];
  contrastPairs: ContrastPairV1[];
  swatches: BrandSwatchV1[];
  locked?: LockedColorV1[];
  /** Reorders each use's candidates. Absent or zero keeps the colour-distance order. */
  seed?: number;
  /** OKLab distance inside a distinction set. Defaults to `DEFAULT_MIN_SEPARATION`. */
  minSeparation?: number;
  /** Object ids carrying raster bytes. An assignment never reaches one, so it is never in `affects`. */
  rasterObjectIds?: string[];
  /** The design system's colour per theme slot name, when it names slots. */
  slots?: Record<string, { hex: string; path?: string }>;
  /** Search nodes per component. Defaults to `SEARCH_NODE_BUDGET`. */
  nodeBudget?: number;
  /**
   * Solve once per ground group (plan 275 section 6.2) rather than once for the
   * deck. Absent keeps the single solve, so a plan with no theme and no
   * Background chip is solved exactly as before.
   */
  grounds?: AssignColorsGroundsV1;
}

/**
 * A ground group (plan 275 section 6.2): the slides that share one ground. `deck`
 * is the deck theme's own ground, whose targets are each mapping's `to`; `dark`
 * and `brand` are the slides a Background chip moved, whose targets go into
 * `ColorMappingV1.byGround`.
 */
export type GroundGroupKeyV1 = 'deck' | 'dark' | 'brand';

export interface GroundGroupV1 {
  ground: GroundGroupKeyV1;
  slideIds: string[];
  /**
   * Each slide's ground as the compile draws it under the theme. A slide's own
   * ground use (`slide:<id>:fill`) is pinned to it, so the census's text-on-ground
   * pairs are measured against the ground the text will really sit on.
   */
  groundBySlide?: Record<string, { hex: string; path?: string }>;
  /** Swatches for this group alone. Defaults to the input's. */
  swatches?: BrandSwatchV1[];
}

/** The solve per ground group: the groups and the slide each object sits on. */
export interface AssignColorsGroundsV1 {
  groups: GroundGroupV1[];
  /** Object id to slide id. The census rows carry it. */
  objectSlides: Record<string, string>;
}

/** A use that has no target on one of its ground groups, with the slides that ground is on. */
export interface ColorGroundIssueV1 {
  useId: string;
  ground: GroundGroupKeyV1;
  reason: ColorUnresolvedReasonV1;
  /** The slides of that group the use appears on, in the order the group lists them. */
  slideIds: string[];
}

/** The role hint each use role asks `nearestBrandColor` for. */
const ROLE_HINT: Record<ColorUseV1['role'], RoleHint> = {
  bg: 'bg',
  ink: 'ink',
  accent: 'accent',
  neutral: 'neutral',
  series: 'accent',
  stroke: 'ink',
};

interface Candidate {
  hex: string;
  path?: string;
}

// ─── small helpers ───────────────────────────────────────────────────────────

function normHex(hex: string): string {
  const raw = hex.trim();
  const body = raw.startsWith('#') ? raw.slice(1) : raw;
  if (body.length === 3) {
    const r = body[0] ?? '0';
    const g = body[1] ?? '0';
    const b = body[2] ?? '0';
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return `#${body.slice(0, 6).toUpperCase()}`;
}

function isHex(hex: string): boolean {
  return /^#[0-9A-F]{6}$/.test(normHex(hex));
}

/**
 * A seeded generator over integer arithmetic. No `Math.random`, and no call
 * into a transcendental function, so two hosts produce the same ordering.
 */
function rngFrom(seed: number): () => number {
  let state = (seed >>> 0) || 0x9e3779b9;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A small stable hash of a use id, so each use shuffles on its own stream. */
function idSeed(useId: string): number {
  let h = 2166136261;
  for (let i = 0; i < useId.length; i += 1) {
    h ^= useId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items];
  const next = rngFrom(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a === undefined || b === undefined) continue;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/**
 * Up to `max` candidate targets for one hex inside one role, taken by calling
 * `nearestBrandColor` over a pool that shrinks by one each round. Reusing that
 * scorer keeps its chroma gate and its role hint as the rule here too.
 */
function candidatesFor(hex: string, role: ColorUseV1['role'], swatches: BrandSwatchV1[], max: number): Candidate[] {
  const pool = swatches.filter((swatch) => isHex(swatch.hex));
  const out: Candidate[] = [];
  const taken = new Set<string>();
  while (out.length < max && pool.length > 0) {
    const scored = nearestBrandColor(
      hex,
      pool.map((swatch) => ({ hex: swatch.hex, name: swatch.path, ...(swatch.role ? { role: swatch.role } : {}) })),
      { roleHint: ROLE_HINT[role] },
    );
    if (!scored) break;
    const index = pool.findIndex((swatch) => normHex(swatch.hex) === normHex(scored.hex));
    if (index < 0) break;
    const swatch = pool[index];
    pool.splice(index, 1);
    if (!swatch) break;
    const key = normHex(swatch.hex);
    if (taken.has(key)) continue;
    taken.add(key);
    out.push({ hex: normHex(swatch.hex), path: swatch.path });
  }
  return out;
}

// ─── the constraint graph ────────────────────────────────────────────────────

interface Node {
  useId: string;
  role: ColorUseV1['role'];
  candidates: Candidate[];
  /**
   * The same candidates in the order the role gives them, the slot colour last,
   * when the slot moved it to the front. A search that runs out of budget in the
   * slot order is asked again in this one before a contrast pair is blamed.
   */
  roleOrder?: Candidate[];
  /** Set when the target is not the solver's to choose, which is only a person's lock. */
  fixed?: Candidate;
  locked: boolean;
}

interface DistinctSet {
  id: string;
  members: string[];
}

interface ContrastEdge {
  fg: string;
  bg: string;
  minimum: number;
}

function separated(a: string, b: string, minSeparation: number): boolean {
  const d = deltaEOk(a, b);
  return Number.isFinite(d) && d >= minSeparation;
}

function contrastHolds(fg: string, bg: string, minimum: number): boolean {
  const ratio = contrastRatio(fg, bg);
  return Number.isFinite(ratio) && ratio >= minimum;
}

interface SolveInput {
  nodes: Node[];
  distinct: DistinctSet[];
  contrast: ContrastEdge[];
  minSeparation: number;
  budget: number;
  withContrast: boolean;
}

/**
 * What one search found: the targets, or none, and whether it stopped on its
 * budget. A search that ran out has not shown the component has no answer.
 */
interface SolveResult {
  picks: Map<string, Candidate> | null;
  exhausted: boolean;
}

/**
 * Backtracking over one component. Nodes are visited in a fixed order (fixed
 * targets first, then the smallest candidate list, then the use id), so a run
 * repeats exactly. The budget counts node visits and stops the search rather
 * than letting a wide component run away.
 */
function solveComponent(input: SolveInput): SolveResult {
  const order = [...input.nodes].sort((a, b) => {
    const fixedFirst = (a.fixed ? 0 : 1) - (b.fixed ? 0 : 1);
    if (fixedFirst !== 0) return fixedFirst;
    const bySize = a.candidates.length - b.candidates.length;
    return bySize !== 0 ? bySize : compareCodeUnits(a.useId, b.useId);
  });
  const assigned = new Map<string, Candidate>();
  let budget = input.budget;
  let exhausted = false;

  const consistent = (node: Node, pick: Candidate): boolean => {
    for (const set of input.distinct) {
      if (!set.members.includes(node.useId)) continue;
      for (const other of set.members) {
        if (other === node.useId) continue;
        const got = assigned.get(other);
        if (!got) continue;
        if (!separated(pick.hex, got.hex, input.minSeparation)) return false;
      }
    }
    if (!input.withContrast) return true;
    for (const edge of input.contrast) {
      if (edge.fg === node.useId) {
        const bg = assigned.get(edge.bg);
        if (bg && !contrastHolds(pick.hex, bg.hex, edge.minimum)) return false;
      } else if (edge.bg === node.useId) {
        const fg = assigned.get(edge.fg);
        if (fg && !contrastHolds(fg.hex, pick.hex, edge.minimum)) return false;
      }
    }
    return true;
  };

  const step = (index: number): boolean => {
    if (index >= order.length) return true;
    const node = order[index];
    if (!node) return true;
    const picks = node.fixed ? [node.fixed] : node.candidates;
    for (const pick of picks) {
      budget -= 1;
      if (budget <= 0) {
        exhausted = true;
        return false;
      }
      if (!consistent(node, pick)) continue;
      assigned.set(node.useId, pick);
      if (step(index + 1)) return true;
      assigned.delete(node.useId);
    }
    return false;
  };

  return step(0) ? { picks: new Map(assigned), exhausted: false } : { picks: null, exhausted };
}

// ─── the assignment ──────────────────────────────────────────────────────────

/**
 * Assign every colour use a design-system target, or say why it could not be.
 *
 * Mappings come back in the order the uses arrived, which the census already
 * sorted, so the result is stable without a second sort.
 */
export function assignColors(input: AssignColorsInputV1): ColorMappingV1[] {
  return input.grounds ? assignColorsByGround(input).colors : solveUses(input, new Map());
}

/**
 * One solve over a set of uses. `pinned` holds targets that are not the solver's
 * to choose and are not a person's lock either: a slide's ground under the deck
 * theme. A pinned use comes back with that target and no `locked` flag.
 */
function solveUses(input: AssignColorsInputV1, pinned: Map<string, Candidate>): ColorMappingV1[] {
  const minSeparation = input.minSeparation ?? DEFAULT_MIN_SEPARATION;
  const budget = input.nodeBudget ?? SEARCH_NODE_BUDGET;
  const seed = input.seed ?? 0;
  const raster = new Set(input.rasterObjectIds ?? []);
  const lockedBy = new Map<string, LockedColorV1>();
  for (const lock of input.locked ?? []) lockedBy.set(lock.useId, lock);

  const swatches = input.swatches.filter((swatch) => isHex(swatch.hex));
  const nodes = new Map<string, Node>();

  for (const use of input.uses) {
    const lock = lockedBy.get(use.useId);
    const slot = use.scheme ? input.slots?.[use.scheme] : undefined;
    const byRole = candidatesFor(use.hex, use.role, swatches, MAX_CANDIDATES);
    let candidates = byRole;
    let roleOrder: Candidate[] | undefined;
    // The slot's own colour goes first and the role's candidates follow it, so
    // the solve keeps the author's slot wherever the constraints allow and moves
    // it only where they do not. The role order, slot last, is kept for a search
    // that runs out of budget in this one.
    if (slot && isHex(slot.hex)) {
      const first: Candidate = { hex: normHex(slot.hex), ...(slot.path ? { path: slot.path } : {}) };
      const rest = byRole.filter((candidate) => candidate.hex !== first.hex);
      candidates = [first, ...rest];
      if (rest.length > 0) roleOrder = [...rest, first];
    }
    const shuffleSeed = (seed ^ idSeed(use.useId)) >>> 0;
    if (seed !== 0 && candidates.length > 1) candidates = shuffled(candidates, shuffleSeed);
    if (seed !== 0 && roleOrder) roleOrder = shuffled(roleOrder, shuffleSeed);
    if (roleOrder?.every((candidate, at) => candidate.hex === candidates[at]?.hex)) roleOrder = undefined;

    const node: Node = { useId: use.useId, role: use.role, candidates, locked: lock !== undefined };
    if (roleOrder) node.roleOrder = roleOrder;
    if (lock && isHex(lock.to)) {
      node.fixed = { hex: normHex(lock.to), ...(lock.toPath ? { path: lock.toPath } : {}) };
    }
    const pin = pinned.get(use.useId);
    if (pin && !node.fixed) node.fixed = pin;
    nodes.set(use.useId, node);
  }

  // Distinction sets, and the contrast pairs whose ends are both known here.
  const distinctById = new Map<string, string[]>();
  for (const use of input.uses) {
    if (!use.distinctionSet) continue;
    const members = distinctById.get(use.distinctionSet) ?? [];
    members.push(use.useId);
    distinctById.set(use.distinctionSet, members);
  }
  const distinct: DistinctSet[] = [...distinctById.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([id, members]) => ({ id, members: [...members].sort() }))
    .sort((a, b) => compareCodeUnits(a.id, b.id));

  const contrast: ContrastEdge[] = input.contrastPairs
    .filter((pair) => nodes.has(pair.foreground) && nodes.has(pair.background) && pair.foreground !== pair.background)
    .map((pair) => ({ fg: pair.foreground, bg: pair.background, minimum: pair.minimum }))
    .sort((a, b) => compareCodeUnits(a.fg, b.fg) || compareCodeUnits(a.bg, b.bg));

  // A person's own locks that cannot both hold: two locked members of one
  // distinction set closer than the separation, or a locked pair under its
  // contrast minimum. Reported as `locked-conflict`, and taken out of the
  // solver so one impossible pair does not make the whole component unresolved.
  const unresolved = new Map<string, ColorUnresolvedReasonV1>();
  for (const set of distinct) {
    const lockedMembers = set.members.filter((id) => nodes.get(id)?.locked && nodes.get(id)?.fixed);
    for (let i = 0; i < lockedMembers.length; i += 1) {
      for (let j = i + 1; j < lockedMembers.length; j += 1) {
        const a = nodes.get(lockedMembers[i] ?? '');
        const b = nodes.get(lockedMembers[j] ?? '');
        if (!a?.fixed || !b?.fixed) continue;
        if (separated(a.fixed.hex, b.fixed.hex, minSeparation)) continue;
        unresolved.set(a.useId, 'locked-conflict');
        unresolved.set(b.useId, 'locked-conflict');
      }
    }
  }
  for (const edge of contrast) {
    const fg = nodes.get(edge.fg);
    const bg = nodes.get(edge.bg);
    if (!fg?.locked || !bg?.locked || !fg.fixed || !bg.fixed) continue;
    if (contrastHolds(fg.fixed.hex, bg.fixed.hex, edge.minimum)) continue;
    unresolved.set(fg.useId, 'locked-conflict');
  }

  const constrained = new Set<string>();
  for (const set of distinct) for (const id of set.members) constrained.add(id);
  for (const edge of contrast) {
    constrained.add(edge.fg);
    constrained.add(edge.bg);
  }
  for (const id of unresolved.keys()) constrained.delete(id);

  // Components: uses tied by a distinction set or a contrast pair solve together.
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let root = id;
    let hop = parent.get(root);
    while (hop !== undefined && hop !== root) {
      root = hop;
      hop = parent.get(root);
    }
    return root;
  };
  const union = (a: string, b: string): void => {
    if (!constrained.has(a) || !constrained.has(b)) return;
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    if (ra < rb) parent.set(rb, ra);
    else parent.set(ra, rb);
  };
  for (const id of constrained) parent.set(id, id);
  for (const set of distinct) {
    const members = set.members.filter((id) => constrained.has(id));
    for (let i = 1; i < members.length; i += 1) union(members[0] ?? '', members[i] ?? '');
  }
  for (const edge of contrast) union(edge.fg, edge.bg);

  const components = new Map<string, string[]>();
  for (const id of [...constrained].sort()) {
    const root = find(id);
    const members = components.get(root) ?? [];
    members.push(id);
    components.set(root, members);
  }

  const chosen = new Map<string, Candidate>();
  // Every use outside a constraint takes its first candidate, or its fixed target.
  for (const use of input.uses) {
    if (constrained.has(use.useId)) continue;
    const node = nodes.get(use.useId);
    if (!node) continue;
    const pick = node.fixed ?? node.candidates[0];
    if (pick) chosen.set(use.useId, pick);
    else if (!unresolved.has(use.useId)) unresolved.set(use.useId, 'no-candidate-in-role');
  }

  for (const root of [...components.keys()].sort()) {
    const memberIds = components.get(root) ?? [];
    const memberNodes = memberIds.map((id) => nodes.get(id)).filter((node): node is Node => node !== undefined);
    const empty = memberNodes.filter((node) => !node.fixed && node.candidates.length === 0);
    for (const node of empty) unresolved.set(node.useId, 'no-candidate-in-role');
    let solving = memberNodes.filter((node) => !empty.includes(node));
    if (solving.length === 0) continue;

    // A distinction set that asks for more distinct targets than its members
    // can reach between them is answered before the search runs: this is the
    // "eight series, four usable colours" case, and the answer is not a collapse.
    //
    // Only that set's own members are answered. A use tied into the same
    // component by something else keeps its place in the search, because a
    // question the palette cannot answer for eight series says nothing about
    // the ink beside them, and a mapping with neither a target nor a reason is
    // the silent gap this module exists to prevent. Taking members out can only
    // shrink another set, never break one, so one pass is enough.
    const beforeIds = new Set(solving.map((node) => node.useId));
    const tooSmallIds = new Set<string>();
    for (const set of distinct) {
      const members = set.members.filter((id) => beforeIds.has(id));
      if (members.length < 2) continue;
      const reachable = new Set<string>();
      for (const id of members) {
        const node = nodes.get(id);
        if (!node) continue;
        if (node.fixed) reachable.add(node.fixed.hex);
        for (const candidate of node.candidates) reachable.add(candidate.hex);
      }
      if (reachable.size >= members.length) continue;
      for (const id of members) {
        tooSmallIds.add(id);
        if (!unresolved.has(id)) unresolved.set(id, 'palette-too-small');
      }
    }
    if (tooSmallIds.size > 0) solving = solving.filter((node) => !tooSmallIds.has(node.useId));
    if (solving.length === 0) continue;

    const ids = new Set(solving.map((node) => node.useId));
    const localDistinct = distinct
      .map((set) => ({ id: set.id, members: set.members.filter((id) => ids.has(id)) }))
      .filter((set) => set.members.length > 1);
    const localContrast = contrast.filter((edge) => ids.has(edge.fg) && ids.has(edge.bg));

    // A slot moved to the front of a list makes the search wider where it holds
    // until late: template-example ran out of budget on one component and a text
    // was blamed for a pair the role order satisfies. A search that stops on its
    // budget has not shown there is no answer, so it is asked again in the role
    // order (the same candidates, the slot last) before a pair is dropped.
    const reordered = solving.some((node) => node.roleOrder && !node.fixed)
      ? solving.map((node) => (node.roleOrder && !node.fixed ? { ...node, candidates: node.roleOrder } : node))
      : undefined;
    const solve = (edges: ContrastEdge[]): Map<string, Candidate> | null => {
      const search = (nodesInOrder: Node[]): SolveResult => solveComponent({
        nodes: nodesInOrder,
        distinct: localDistinct,
        contrast: edges,
        minSeparation,
        budget,
        withContrast: true,
      });
      const first = search(solving);
      if (first.picks || !first.exhausted || !reordered) return first.picks;
      return search(reordered).picks;
    };

    const solved = solve(localContrast);
    if (solved) {
      for (const [id, pick] of solved) chosen.set(id, pick);
      continue;
    }

    // Contrast was the blocker when the same component solves with fewer pairs.
    // The pairs are dropped ONE AT A TIME, smallest set first, so a pair that
    // could have held is not blamed for one that could not: dropping every pair
    // at once picks targets with no regard for the pairs that were satisfiable,
    // and those then read as unreachable too.
    let active = [...localContrast];
    const dropped: ContrastEdge[] = [];
    let relaxed: Map<string, Candidate> | null = null;
    let trials = 0;
    while (active.length > 0) {
      let index = -1;
      for (let i = 0; i < active.length && trials < RELAX_TRIAL_BUDGET; i += 1) {
        trials += 1;
        const trial = active.filter((_, at) => at !== i);
        const got = solve(trial);
        if (!got) continue;
        index = i;
        relaxed = got;
        break;
      }
      if (index >= 0) {
        const edge = active[index];
        if (edge) dropped.push(edge);
        active = active.filter((_, at) => at !== index);
        break;
      }
      if (trials >= RELAX_TRIAL_BUDGET) {
        // A component with many pairs would cost a search per pair per round.
        // Past the budget the remaining pairs go together, which is the answer
        // this module gave before and is still an answer, reported on each one.
        for (const edge of active) dropped.push(edge);
        active = [];
        relaxed = solve([]);
        break;
      }
      // No single pair unblocks the rest, so the first one goes and the
      // question is asked again over what is left.
      const first = active[0];
      if (!first) break;
      dropped.push(first);
      active = active.slice(1);
    }

    if (relaxed) {
      for (const [id, pick] of relaxed) chosen.set(id, pick);
      for (const edge of dropped) {
        // The end the solver could have moved carries the reason. Where both
        // ends are the solver's to choose, the foreground does, because the ink
        // is what a reader is being asked about.
        const fg = nodes.get(edge.fg);
        const blamed = fg?.fixed && !nodes.get(edge.bg)?.fixed ? edge.bg : edge.fg;
        chosen.delete(blamed);
        if (!unresolved.has(blamed)) unresolved.set(blamed, 'contrast-unreachable');
      }
      continue;
    }

    for (const node of solving) {
      if (node.fixed) {
        chosen.set(node.useId, node.fixed);
        continue;
      }
      if (!unresolved.has(node.useId)) unresolved.set(node.useId, 'palette-too-small');
    }
  }

  // Nothing leaves this function with neither a target nor a reason. A mapping
  // that carries only a source hex tells a compile nothing and shows a reader
  // nothing, so a use the work above did not reach is named here.
  for (const use of input.uses) {
    if (chosen.has(use.useId) || unresolved.has(use.useId)) continue;
    const node = nodes.get(use.useId);
    unresolved.set(use.useId, node && !node.fixed && node.candidates.length === 0 ? 'no-candidate-in-role' : 'palette-too-small');
  }

  // A use whose lock could not hold keeps the person's own target beside the
  // reason, because the lock is a stated choice rather than a failed search.
  for (const [id, reason] of unresolved) {
    if (reason !== 'locked-conflict') continue;
    const node = nodes.get(id);
    if (node?.fixed) chosen.set(id, node.fixed);
  }

  return input.uses.map((use) => {
    const node = nodes.get(use.useId);
    const pick = chosen.get(use.useId);
    const reason = unresolved.get(use.useId);
    const affects = use.objectIds.filter((id) => !raster.has(id));
    if (affects.length === 0 && use.objectIds.length === 0 && use.useId.endsWith(':fill')) {
      affects.push(`${use.useId.slice(0, -':fill'.length)}#background`);
    }
    const mapping: ColorMappingV1 = {
      useId: use.useId,
      from: normHex(use.hex),
      role: use.role,
      affects: [...affects].sort(),
    };
    if (use.scheme) mapping.scheme = use.scheme;
    if (pick && (!reason || reason === 'locked-conflict')) {
      mapping.to = pick.hex;
      if (pick.path) mapping.toPath = pick.path;
    }
    if (node?.locked) mapping.locked = true;
    if (reason) mapping.unresolved = reason;
    return mapping;
  });
}

// ─── the solve per ground group ──────────────────────────────────────────────

/** The id of the slide a slide ground use belongs to (`slide:<id>:fill`, with the census's collision suffix), else undefined. */
function groundUseSlide(useId: string): string | undefined {
  const match = /^slide:(.+):fill(?::[0-9a-f]{6}(?::\d+)?)?$/.exec(useId);
  return match ? match[1] : undefined;
}

const GROUP_ORDER: readonly GroundGroupKeyV1[] = ['deck', 'dark', 'brand'];

/**
 * Assign colours once per ground group (plan 275 section 6.2) and fold the answers
 * into one mapping per use.
 *
 * A use's `to` is its target on the deck theme's own ground; a use that also sits on
 * a slide a Background chip moved to Dark or Brand gets a second target for that
 * ground in `byGround`. Each group is its own solve: the uses on that group's
 * slides, the census contrast pairs whose object is on those slides, and each
 * slide's ground use pinned to the ground the compile draws there. A use on no
 * group's slide (an object on a slide the plan left out) is solved with the deck.
 *
 * A use that has no target on its deck ground gets `unresolved` with the reason and
 * an issue naming the slides. A failure on a moved ground only is recorded there and
 * nowhere else: the `byGround` entry for that ground holds no target, and an issue
 * names the ground and its slides. The row itself stays resolved with its deck `to`,
 * because a compile skips a row that carries `unresolved` on every slide, and one
 * slide moved to Dark must not take a colour (a person's own locked colour among
 * them) away from every slide still on the deck ground. A reader of `byGround` takes
 * an entry with no `to` as "no colour holds on this ground".
 *
 * Pure and deterministic: the groups are solved in a fixed order and each solve is
 * the single solve `assignColors` runs.
 */
export function assignColorsByGround(input: AssignColorsInputV1): { colors: ColorMappingV1[]; issues: ColorGroundIssueV1[] } {
  const grounds = input.grounds;
  if (!grounds || grounds.groups.length === 0) return { colors: solveUses(input, new Map()), issues: [] };
  const groups = [...grounds.groups].sort((a, b) => GROUP_ORDER.indexOf(a.ground) - GROUP_ORDER.indexOf(b.ground));
  const slideOf = (objectId: string): string | undefined => grounds.objectSlides[objectId];

  // Which groups each use sits on, by the slides of its objects or its own slide ground.
  const groupSlides = groups.map((group) => new Set(group.slideIds));
  const onGroup = new Map<string, number[]>();
  for (const use of input.uses) {
    const slides = new Set<string>();
    const own = groundUseSlide(use.useId);
    if (own !== undefined && use.objectIds.length === 0) slides.add(own);
    for (const id of use.objectIds) {
      const slide = slideOf(id);
      if (slide !== undefined) slides.add(slide);
    }
    const hits: number[] = [];
    groupSlides.forEach((set, at) => {
      for (const slide of slides) {
        if (set.has(slide)) {
          hits.push(at);
          return;
        }
      }
    });
    onGroup.set(use.useId, hits);
  }
  const deckAt = groups.findIndex((group) => group.ground === 'deck');

  const results: Array<Map<string, ColorMappingV1>> = groups.map((group, at) => {
    const members = input.uses.filter((use) => {
      const hits = onGroup.get(use.useId) ?? [];
      return hits.includes(at) || (at === deckAt && hits.length === 0);
    });
    const slides = groupSlides[at] ?? new Set<string>();
    const memberIds = new Set(members.map((use) => use.useId));
    const pairs = input.contrastPairs.filter((pair) => {
      if (!memberIds.has(pair.foreground) || !memberIds.has(pair.background)) return false;
      const slide = slideOf(pair.objectId) ?? groundUseSlide(pair.objectId);
      return slide === undefined ? at === deckAt : slides.has(slide);
    });
    const pinned = new Map<string, Candidate>();
    for (const use of members) {
      const own = groundUseSlide(use.useId);
      if (own === undefined || use.objectIds.length > 0) continue;
      const ground = group.groundBySlide?.[own];
      if (ground && isHex(ground.hex)) pinned.set(use.useId, { hex: normHex(ground.hex), ...(ground.path ? { path: ground.path } : {}) });
    }
    const { grounds: _grounds, ...rest } = input;
    const solved = solveUses({
      ...rest,
      uses: members,
      contrastPairs: pairs,
      swatches: group.swatches ?? input.swatches,
    }, pinned);
    return new Map(solved.map((row) => [row.useId, row]));
  });

  const issues: ColorGroundIssueV1[] = [];
  const colors = input.uses.map((use): ColorMappingV1 => {
    const hits = onGroup.get(use.useId) ?? [];
    const primaryAt = hits.includes(deckAt) || hits.length === 0 ? deckAt : (hits[0] ?? deckAt);
    const primary = results[primaryAt]?.get(use.useId) ?? results[0]?.get(use.useId);
    const mapping: ColorMappingV1 = primary ? structuredClone(primary) : { useId: use.useId, from: normHex(use.hex), role: use.role, affects: [] };
    const slidesOn = (at: number): string[] => {
      const group = groups[at];
      if (!group) return [];
      const own = groundUseSlide(use.useId);
      const mine = new Set(use.objectIds.map((id) => slideOf(id)).filter((id): id is string => id !== undefined));
      if (own !== undefined && use.objectIds.length === 0) mine.add(own);
      return group.slideIds.filter((id) => mine.has(id));
    };
    if (primary?.unresolved) {
      issues.push({ useId: use.useId, ground: groups[primaryAt]?.ground ?? 'deck', reason: primary.unresolved, slideIds: slidesOn(primaryAt) });
    }
    for (const at of hits) {
      if (at === primaryAt) continue;
      const group = groups[at];
      const row = results[at]?.get(use.useId);
      if (!group || group.ground === 'deck' || !row) continue;
      const entry: { to?: string; toPath?: string } = {};
      if (row.to && (!row.unresolved || row.unresolved === 'locked-conflict')) {
        entry.to = row.to;
        if (row.toPath !== undefined) entry.toPath = row.toPath;
      }
      mapping.byGround = { ...(mapping.byGround ?? {}), [group.ground]: entry };
      if (row.unresolved) issues.push({ useId: use.useId, ground: group.ground, reason: row.unresolved, slideIds: slidesOn(at) });
    }
    return mapping;
  });
  return { colors, issues };
}
