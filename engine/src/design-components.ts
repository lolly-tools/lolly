// SPDX-License-Identifier: MPL-2.0
/**
 * Penpot component definitions → template descriptors (pure collectors).
 *
 * A sibling of design-map.ts, which stays a shape→box MAPPER: this module reads
 * the OTHER half of a binfile-v3 export — the `files/<fid>/components/*.json`
 * records and the instance back-links on the shapes — and answers two questions
 * the components-as-templates work asks:
 *
 *   1. which reusable components does this file define, and where is each one's
 *      master subtree (`collectPenpotComponents`);
 *   2. which parts of a master are meant to be filled in (`penpotComponentSlots`).
 *
 * PURE and DOM-free, same contract as design-map: parsed JSON in, data out. No
 * `document`, no imports from shells/ or tools/, no network. The shell owns the
 * zip, the asset store and the subtree→boxes walk; this module only reads the
 * structure, so it is unit-testable everywhere the engine runs.
 *
 * VARIANTS (the structure a plan written before the kitchen-sink fixture could
 * not know): Penpot 2.17 serializes a variant SET as one component record PER
 * VARIANT — same `name`, same `variantId`, one `variantProperties` pair each —
 * whose main instances live inside an `isVariantContainer` flex frame. Shape
 * names propagate across the whole set, so N variants read as N near-identical
 * components with identical names. Grouping by `variantId` is therefore not a
 * nicety: without it a 2-variant button set becomes two templates called
 * "button" that a user cannot tell apart. One logical component, one variant
 * list (observed in tests/fixtures/penpot-kitchen-sink.penpot).
 */

import { parsePenpotContent } from './design-map.ts';

/** A parsed Penpot shape (or component record) — any object with string keys. */
type Rec = Record<string, unknown>;

/**
 * The shapes of a file, page id → (shape id → shape). Either container the
 * callers already build works: the shell/tests keep a Map, a plain object is
 * accepted for the JSON-shaped path.
 */
export type PenpotShapesByPage =
  | Map<string, Record<string, unknown>>
  | Record<string, Record<string, unknown>>;

/** One variant of a component set (a single component record). */
export interface PenpotComponentVariant {
  /** The component record's own id — permanent within the file. */
  id: string;
  /** `mainInstanceId` — the master frame this variant renders from. */
  rootShapeId: string;
  /** `mainInstancePage` — the page holding that master. */
  pageId: string;
  /** Authored property pairs, e.g. `[{name:'Property 1', value:'Value 2'}]`. */
  properties: Array<{ name: string; value: string }>;
  /** The property values joined for display ('Value 2'); '' for a non-variant. */
  label: string;
}

/** One logical component — a plain component, or a whole variant set. */
export interface PenpotComponent {
  /** The set id (`variantId`) when this is a variant set, else the record id. */
  id: string;
  /** The authored component name (shared by every variant of a set). */
  name: string;
  /** The authored grouping path ('titles', 'text'); '' when ungrouped. */
  path: string;
  /** The DEFAULT variant's master shape id — what a v1 template maps. */
  rootShapeId: string;
  /** The page holding `rootShapeId`. */
  pageId: string;
  /** Always false here: an external component has no definition to collect. */
  external: false;
  /** True when the record(s) carried a `variantId` (a real variant set). */
  isVariantSet: boolean;
  /** Every variant, `variants[0]` being the default (== `rootShapeId`). */
  variants: PenpotComponentVariant[];
}

/** One foreign component, as seen from its instances in THIS file. */
export interface PenpotExternalComponent {
  componentId: string;
  /** The library file id — absent from this export, hence "external". */
  componentFile: string;
  /** The first instance's shape name — the only label an external one has. */
  name: string;
  /** How many instance roots point at it. */
  instances: number;
}

/** The aggregate the import warn copy is written from. */
export interface PenpotExternalCensus {
  /** Instance roots pointing at a foreign file. */
  instances: number;
  /** Distinct foreign file ids, sorted. */
  files: string[];
  /** One row per distinct foreign `componentId`, sorted by name then id. */
  components: PenpotExternalComponent[];
}

export interface PenpotComponentCollection {
  /** Locally defined components, sorted by path, then name, then id. */
  components: PenpotComponent[];
  externals: PenpotExternalCensus;
  /** The file id externality was measured against (given, or inferred). */
  localFileId: string | null;
  /** Human-readable notes: unresolvable masters, an undeterminable file id. */
  warnings: string[];
}

/** A fill-in-the-blank in a component master. */
export interface PenpotComponentSlot {
  /** The master shape the slot edits. */
  shapeId: string;
  kind: 'text' | 'image';
  /** The Penpot shape `name` — what the author called it. */
  label: string;
  /** Text slots: the master's placeholder copy (lorem ipsum by construction). */
  text?: string;
  /** Asset slots: the fill's media id; the shell resolves it to bytes. */
  imageId?: string;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);

/** Both accepted `shapesByPage` containers → a plain Map. */
function pageMap(shapesByPage: PenpotShapesByPage): Map<string, Rec> {
  const out = new Map<string, Rec>();
  if (shapesByPage instanceof Map) {
    for (const [pid, shapes] of shapesByPage) if (isRec(shapes)) out.set(String(pid), shapes as Rec);
  } else if (isRec(shapesByPage)) {
    for (const [pid, shapes] of Object.entries(shapesByPage)) if (isRec(shapes)) out.set(pid, shapes as Rec);
  }
  return out;
}

/** `variantProperties` → normalized pairs (Penpot writes `{name, value}`). */
function variantProps(v: unknown): Array<{ name: string; value: string }> {
  if (!Array.isArray(v)) return [];
  const out: Array<{ name: string; value: string }> = [];
  for (const p of v) {
    if (!isRec(p)) continue;
    out.push({ name: str(p.name), value: str(p.value) });
  }
  return out;
}

/**
 * Collect a Penpot file's component definitions, grouping a variant set into one
 * logical component, plus a census of the instances that point at libraries this
 * export does not carry.
 *
 * Externality is decided by `componentFile`, NEVER by "no local definition with
 * that id": ids are preserved across file copies, so a foreign instance can and
 * does carry a componentId that also names a local component (4 of the 6 in the
 * UXDays keynote do). `fileId` is taken from `opts` when the caller has the
 * manifest; otherwise it is inferred from a master shape, which always names its
 * own file in `componentFile`. With neither, the census is empty and says so.
 *
 * @param componentJsons parsed `files/<fid>/components/*.json` records.
 * @param shapesByPage page id → shape id → parsed shape, for every page.
 * @param opts `fileId`: the local file id from the manifest.
 */
export function collectPenpotComponents(
  componentJsons: unknown,
  shapesByPage: PenpotShapesByPage,
  opts: { fileId?: string } = {},
): PenpotComponentCollection {
  const pages = pageMap(shapesByPage);
  const warnings: string[] = [];
  const records = Array.isArray(componentJsons) ? componentJsons.filter(isRec) : [];

  /** The master shape for a record, honouring `mainInstancePage` then scanning. */
  const findMaster = (rootShapeId: string, declaredPage: string): { shape: Rec; pageId: string } | null => {
    if (!rootShapeId) return null;
    const declared = pages.get(declaredPage);
    const hit = declared ? declared[rootShapeId] : undefined;
    if (isRec(hit)) return { shape: hit, pageId: declaredPage };
    // A stale/absent mainInstancePage is recoverable — the id is unique file-wide.
    for (const [pid, shapes] of pages) {
      const s = shapes[rootShapeId];
      if (isRec(s)) return { shape: s, pageId: pid };
    }
    return null;
  };

  // Pass 1 — records → variants, keyed by set (variantId) or by record id.
  interface Group { id: string; name: string; path: string; isVariantSet: boolean; variants: PenpotComponentVariant[] }
  const groups = new Map<string, Group>();
  let inferredFileId = '';
  for (const rec of records) {
    const id = str(rec.id);
    const name = str(rec.name);
    const rootShapeId = str(rec.mainInstanceId);
    const declaredPage = str(rec.mainInstancePage);
    const master = findMaster(rootShapeId, declaredPage);
    if (!master) {
      warnings.push(`component ${JSON.stringify(name)} (${id || 'no id'}): master shape ${rootShapeId || '(none)'} not found`);
      continue;
    }
    if (!inferredFileId) inferredFileId = str(master.shape.componentFile);
    const props = variantProps(rec.variantProperties);
    const variantId = str(rec.variantId);
    const key = variantId || id;
    let g = groups.get(key);
    if (!g) {
      g = { id: key, name, path: str(rec.path), isVariantSet: !!variantId, variants: [] };
      groups.set(key, g);
    }
    // A set's records carry the same name/path; keep the first non-empty of each.
    if (!g.name) g.name = name;
    if (!g.path) g.path = str(rec.path);
    g.variants.push({
      id,
      rootShapeId,
      pageId: master.pageId,
      properties: props,
      label: props.map((p) => p.value).filter(Boolean).join(' / '),
    });
  }

  // Pass 2 — order deterministically (zip entry order is arbitrary) and pick the
  // default variant: the first by label, so "Value 1" leads "Value 2".
  const components: PenpotComponent[] = [];
  for (const g of groups.values()) {
    g.variants.sort((a, b) => (a.label || '').localeCompare(b.label || '') || a.id.localeCompare(b.id));
    const first = g.variants[0]!;
    components.push({
      id: g.id,
      name: g.name,
      path: g.path,
      rootShapeId: first.rootShapeId,
      pageId: first.pageId,
      external: false,
      isVariantSet: g.isVariantSet,
      variants: g.variants,
    });
  }
  components.sort((a, b) => a.path.localeCompare(b.path) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

  // Pass 3 — the externals census, off the instance roots.
  const localFileId = str(opts.fileId) || inferredFileId || null;
  const byComponent = new Map<string, PenpotExternalComponent>();
  const files = new Set<string>();
  let instances = 0;
  if (localFileId) {
    for (const shapes of pages.values()) {
      for (const shape of Object.values(shapes)) {
        if (!isRec(shape)) continue;
        const componentId = str(shape.componentId);
        const componentFile = str(shape.componentFile);
        // Masters are local by definition; descendants of an instance carry only
        // `shapeRef`, so a componentId marks an instance root.
        if (!componentId || !componentFile || shape.mainInstance === true) continue;
        if (componentFile === localFileId) continue;
        instances++;
        files.add(componentFile);
        const key = `${componentFile}/${componentId}`;
        const row = byComponent.get(key);
        if (row) row.instances++;
        else byComponent.set(key, { componentId, componentFile, name: str(shape.name), instances: 1 });
      }
    }
  } else if (records.length) {
    warnings.push('external-library census skipped: no local file id (pass opts.fileId)');
  }

  const externals: PenpotExternalCensus = {
    instances,
    files: [...files].sort(),
    components: [...byComponent.values()]
      .sort((a, b) => a.name.localeCompare(b.name) || a.componentId.localeCompare(b.componentId)),
  };
  return { components, externals, localFileId, warnings };
}

/** The slot a shape contributes, or null when it is ordinary decoration. */
function slotFor(sh: Rec): Omit<PenpotComponentSlot, 'shapeId'> | null {
  const label = str(sh.name);
  // Text first, matching penpotShapeToNode's branch order: a text shape with an
  // image fill is still text.
  if (str(sh.type) === 'text') {
    const text = sh.content ? parsePenpotContent(sh.content).text : '';
    return text ? { kind: 'text', label, text } : { kind: 'text', label };
  }
  const fills = Array.isArray(sh.fills) ? sh.fills : [];
  for (const f of fills) {
    if (!isRec(f)) continue;
    const img = f.fillImage;
    if (isRec(img) && img.id != null) return { kind: 'image', label, imageId: String(img.id) };
  }
  return null;
}

/**
 * Infer the fill-in-the-blank slots of a component master: text shapes become
 * text slots (a master's own copy is placeholder by construction — that is what
 * a master is for), image-filled shapes become asset slots, and the label is the
 * author's own shape `name`.
 *
 * Depth-first in Penpot's authored child order, root included, cycle-guarded.
 * Hidden shapes (and their subtrees) are skipped: an invisible shape is not a
 * blank anyone fills. This is the same evidence `penpotShapeToNode` keys on, so
 * a slot always corresponds to a box the master subtree maps to.
 *
 * @param rootShape the master shape (`mainInstanceId`'s shape).
 * @param lookup shape id → shape, within the master's page.
 */
export function penpotComponentSlots(rootShape: unknown, lookup: (id: string) => unknown): PenpotComponentSlot[] {
  const out: PenpotComponentSlot[] = [];
  const seen = new Set<string>();
  const walk = (shape: unknown): void => {
    if (!isRec(shape)) return;
    const id = str(shape.id);
    if (id) {
      if (seen.has(id)) return;
      seen.add(id);
    }
    if (shape.hidden === true) return;
    const slot = slotFor(shape);
    if (slot) out.push({ shapeId: id, ...slot });
    const kids = Array.isArray(shape.shapes) ? shape.shapes : [];
    for (const k of kids) walk(lookup(String(k)));
  };
  walk(rootShape);
  return out;
}
