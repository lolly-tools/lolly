// SPDX-License-Identifier: MPL-2.0
/**
 * The generated tables in the agent skill's Diagrams reference
 * (skills/lolly/reference/diagrams.md), and the blocks the Diagrams tool skill
 * (community/diagram-builder/skill/workflow.md) copies from the reference.
 *
 * Controls, options and defaults come from the public manifest, and the look
 * recipes come from community/diagram-builder/source/appearance.js, the code the
 * tool runs. A changed option, default or recipe therefore shows up as generator
 * drift. A few facts are not in any manifest field: what each export format holds,
 * where Mermaid, DOT, ASCII and Pikchr put cards, and which field carries each
 * type's structure. Those notes are keyed by value below, and a value the manifest
 * does not declare, or a declared value with no note, stops the run.
 *
 * Shared prose lives once, in diagrams.md, between `<!-- SHARE:name -->` markers.
 * workflow.md holds `<!-- GEN:name -->` markers; each is filled with the table or
 * shared block of the same name, so the tool skill cannot drift from the reference.
 */
import { NODE_FORMATS } from '@lolly-tools/node-shell/raster';
import { dbRecipe } from '../../community/diagram-builder/source/appearance.js';

interface Option { value: string; label?: string }
type Condition = Record<string, unknown>;
export interface DiagramInput {
  id: string;
  type?: string;
  label?: string;
  help?: string;
  default?: unknown;
  options?: Option[];
  fields?: DiagramInput[];
  showIf?: Condition | Condition[];
  dataSource?: { accept?: string };
  optionsFrom?: { input?: string; value?: string; freeText?: boolean; sources?: { input: string; value: string }[] };
}
export interface DiagramManifest {
  inputs: DiagramInput[];
  render: { formats: string[]; width?: number; height?: number };
}

/** The looks that run a recipe. Legacy is the manifest's own defaults. */
const MODERN_LOOKS = ['minimal', 'editorial', 'soft', 'flow', 'studio'];
/** Global colours a recipe clears so that they follow the design system. */
const INHERITED_COLOURS = ['nodeFill', 'nodeStroke', 'nodeText', 'edgeColor', 'background'];

/** Where cards go for a source that does not take `diagramType`. */
const SOURCE_LAYOUT: Record<string, string> = {
  ascii: 'Keeps the drawn positions',
  mermaid: '`process`, or `layercake` when there are subgraphs; a `sequenceDiagram` becomes `process`',
  dot: '`process`, or `layercake` when there are clusters',
  pikchr: 'Keeps the positions the Pikchr layout computes',
};

/** The field or order that carries each type's meaning. */
const TYPE_STRUCTURE: Record<string, string> = {
  org: 'Each card\'s `parent`',
  mindmap: 'Each card\'s `parent`',
  layercake: 'Each card\'s `layer`, bands in `layers` order',
  kanban: 'Each card\'s `layer`, one column per group',
  process: 'Connections (`arrows`, or the source\'s edges)',
  timeline: 'Card order',
  cycle: 'Card order, closing back to the first card',
  pyramid: 'Card order, top to bottom',
  matrix: 'Each card\'s `quadrant`, with the four axis labels',
  gantt: 'Each card\'s dates, or `ganttStart` and `ganttLen`',
};

/** What each declared export format holds. Kept in step with the tool README. */
const EXPORT_NOTES: Record<string, string> = {
  svg: 'Vector cards, paths and text; colour transitions and shadows drawn as sampled vector bands',
  png: 'Raster artwork at the export size',
  jpg: 'Raster artwork at the export size, no transparency',
  webp: 'Raster artwork at the export size',
  avif: 'Raster artwork at the export size',
  pdf: 'Vector geometry and outlined text',
  'pdf-cmyk': 'Vector geometry and outlined text, converted to CMYK',
  penpot: 'Separate editable paths and text where the importer supports them; no connector or diagram semantics',
  pptx: 'The diagram placed as artwork; no native editable shapes or connectors',
  emf: 'Outlined geometry; transparency flattened against the export background',
  dxf: 'Technical path geometry; fills, gradients and depth are not kept',
};

/** One line of text; a table cell also escapes its pipes. */
const flat = (value: string): string => value.replace(/\s+/g, ' ').trim();
const cell = (value: string): string => flat(value).replace(/\|/g, '\\|');
const code = (value: string): string => `\`${value}\``;
const codes = (values: string[]): string => values.map(code).join(', ');

function value(v: unknown): string {
  if (v === undefined) return '-';
  if (v === '') return 'blank';
  if (typeof v === 'string') return code(v.length > 32 ? `${v.slice(0, 31)}…` : v);
  if (Array.isArray(v)) return v.length ? 'sample rows' : '`[]`';
  return code(JSON.stringify(v));
}

/** First sentence of a help string, for a table cell. */
function firstSentence(text: string | undefined): string {
  if (!text) return '';
  const line = flat(text);
  const stop = line.search(/\.(\s|$)/);
  return stop >= 0 ? line.slice(0, stop + 1) : line;
}

function input(manifest: DiagramManifest, id: string): DiagramInput {
  const found = manifest.inputs.find((i) => i.id === id);
  if (!found) throw new Error(`gen-agent-skill: diagram-builder has no input "${id}"`);
  return found;
}
function optionValues(item: DiagramInput): string[] {
  if (!item.options?.length) throw new Error(`gen-agent-skill: diagram-builder input "${item.id}" has no options`);
  return item.options.map((o) => o.value);
}
function alternatives(item: DiagramInput): Condition[] {
  if (!item.showIf) return [];
  return Array.isArray(item.showIf) ? item.showIf : [item.showIf];
}
function listOf(cond: Condition, key: string): string[] | null {
  const v = cond[key];
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.map(String);
  return null;
}
/** Every input and block field, with a printable path (`nodes.quadrant`). */
function everyControl(manifest: DiagramManifest): { path: string; item: DiagramInput }[] {
  const out: { path: string; item: DiagramInput }[] = [];
  for (const item of manifest.inputs) {
    out.push({ path: item.id, item });
    for (const field of item.fields ?? []) out.push({ path: `${item.id}.${field.id}`, item: field });
  }
  return out;
}
/** Fail when keyed notes and the declared values disagree in either direction. */
function sameKeys(what: string, notes: Record<string, string>, declared: string[]): void {
  const missing = declared.filter((v) => !(v in notes));
  const extra = Object.keys(notes).filter((v) => !declared.includes(v));
  if (missing.length || extra.length) {
    throw new Error(`gen-agent-skill: diagram ${what} notes are out of step with the manifest `
      + `(no note for: ${missing.join(', ') || 'none'}; not declared: ${extra.join(', ') || 'none'})`);
  }
}

/** A short reading of a showIf condition for the field tables. */
function shownWhen(item: DiagramInput, types: string[]): string {
  const parts = alternatives(item).map((cond) => Object.keys(cond).map((key) => {
    const vals = listOf(cond, key) ?? [String(cond[key])];
    if (key === 'look' && vals.length === MODERN_LOOKS.length && MODERN_LOOKS.every((l) => vals.includes(l))) return 'a modern look';
    if (key === 'diagramType' && vals.length > types.length / 2) {
      return `any type but ${codes(types.filter((t) => !vals.includes(t)))}`;
    }
    return `${code(key)} ${vals.map((v) => code(v)).join(' or ')}`;
  }).join(' and '));
  return parts.length ? parts.join('; or ') : 'always';
}

function sourcesTable(m: DiagramManifest): string {
  const source = input(m, 'source');
  const values = optionValues(source);
  const typed = alternatives(input(m, 'diagramType')).flatMap((c) => listOf(c, 'source') ?? []);
  sameKeys('source layout', SOURCE_LAYOUT, values.filter((v) => !typed.includes(v)));
  const rows = source.options!.map((o) => {
    const content = m.inputs.filter((i) => (i.type === 'longtext' || i.type === 'blocks')
      && alternatives(i).some((c) => { const s = listOf(c, 'source'); return s?.length === 1 && s[0] === o.value; }));
    if (!content.length) throw new Error(`gen-agent-skill: diagram source "${o.value}" has no content input`);
    const files = content.flatMap((i) => i.dataSource?.accept?.split(',') ?? []).filter((f) => f.startsWith('.'));
    const sample = content.filter((i) => (Array.isArray(i.default) ? i.default.length : i.default));
    const layout = typed.includes(o.value) ? 'The chosen `diagramType`' : SOURCE_LAYOUT[o.value]!;
    return `| ${code(o.value)} | ${cell(o.label ?? '')} | ${codes(content.map((i) => i.id))} | `
      + `${files.length ? codes(files) : '-'} | ${layout} | ${sample.length ? `Sample content in ${codes(sample.map((i) => i.id))}` : 'Empty'} |`;
  });
  return ['| `source` | Label | Content input | Files | Layout | Default content |', '|---|---|---|---|---|---|', ...rows].join('\n');
}

function sourceSyntax(m: DiagramManifest): string {
  const source = input(m, 'source');
  return source.options!.flatMap((o) => m.inputs
    .filter((i) => (i.type === 'longtext' || i.type === 'blocks')
      && alternatives(i).some((c) => { const s = listOf(c, 'source'); return s?.length === 1 && s[0] === o.value; }))
    .map((i) => `- ${code(o.value)}, ${code(i.id)}: ${flat(i.help ?? i.label ?? '')}`)).join('\n');
}

function typesTable(m: DiagramManifest): string {
  const type = input(m, 'diagramType');
  const types = optionValues(type);
  sameKeys('type structure', TYPE_STRUCTURE, types);
  const rows = type.options!.map((o) => {
    const own = everyControl(m).filter(({ item }) => alternatives(item).some((c) => {
      const t = listOf(c, 'diagramType');
      return !!t && t.length <= 4 && t.includes(o.value);
    })).map(({ path }) => path);
    return `| ${code(o.value)} | ${cell(o.label ?? '')} | ${TYPE_STRUCTURE[o.value]} | ${own.length ? codes(own) : '-'} |`;
  });
  return ['| `diagramType` | Label | Structure comes from | Controls for this type |', '|---|---|---|---|', ...rows].join('\n');
}

function recipeOf(look: string): Record<string, unknown> {
  return dbRecipe(look) as Record<string, unknown>;
}

function looksTable(m: DiagramManifest): string {
  const look = input(m, 'look');
  const looks = optionValues(look);
  const modern = looks.filter((l) => l !== 'legacy');
  if (modern.join() !== MODERN_LOOKS.join() || !looks.includes('legacy')) {
    throw new Error(`gen-agent-skill: diagram looks changed (${looks.join(', ')}); update MODERN_LOOKS and the reference`);
  }
  const base = recipeOf('minimal');
  const rows = look.options!.map((o) => {
    let recipe: string;
    if (o.value === 'legacy') recipe = 'No recipe: the manifest defaults, plus the Legacy-only controls';
    else if (o.value === 'minimal') recipe = 'The base recipe';
    else {
      const r = recipeOf(o.value);
      const diff = Object.keys(r).filter((k) => r[k] !== base[k]).map((k) => `${code(k)} ${value(r[k])}`);
      recipe = diff.length ? `Minimal with ${diff.join(', ')}` : 'Same as Minimal';
    }
    return `| ${code(o.value)} | ${cell(o.label ?? '')} | ${recipe} |`;
  });
  return ['| `look` | Label | Recipe |', '|---|---|---|', ...rows].join('\n');
}

function defaultsTable(m: DiagramManifest): string {
  const recipe = { ...recipeOf('minimal'), ...Object.fromEntries(INHERITED_COLOURS.map((id) => [id, ''])) };
  const differ: string[] = [];
  const same: string[] = [];
  for (const [id, seeded] of Object.entries(recipe)) {
    const manifestDefault = input(m, id).default;
    if (manifestDefault === seeded) same.push(id);
    else differ.push(`| ${code(id)} | ${value(manifestDefault)} | ${seeded === '' ? 'blank (follows the design system)' : value(seeded)} |`);
  }
  return [
    `Manifest default for \`look\`: ${value(input(m, 'look').default)}.`,
    '',
    '| Control | Manifest default (Legacy) | Minimal recipe |',
    '|---|---|---|',
    ...differ,
    '',
    `Same value in both: ${codes(same)}.`,
  ].join('\n');
}

function lookControls(m: DiagramManifest): string {
  const legacy: string[] = [];
  const modern: string[] = [];
  const some: Record<string, string[]> = {};
  for (const { path, item } of everyControl(m)) {
    const alts = alternatives(item);
    const looks = alts.map((c) => listOf(c, 'look'));
    if (!alts.length || looks.some((l) => !l)) continue;
    const union = [...new Set(looks.flat() as string[])];
    if (union.length === 1 && union[0] === 'legacy') legacy.push(path);
    else if (union.every((l) => MODERN_LOOKS.includes(l))) {
      const key = union.map(code).join(', ');
      if (union.length === MODERN_LOOKS.length) modern.push(path);
      else some[key] = [...(some[key] ?? []), path];
    }
  }
  return [
    `- Legacy only: ${codes(legacy)}.`,
    `- Every modern look: ${codes(modern)}.`,
    ...Object.entries(some).map(([looks, paths]) => `- Only ${looks}: ${codes(paths)}.`),
  ].join('\n');
}

function fieldTable(m: DiagramManifest, id: string): string {
  const types = optionValues(input(m, 'diagramType'));
  const block = input(m, id);
  if (!block.fields?.length) throw new Error(`gen-agent-skill: diagram-builder input "${id}" has no fields`);
  const rows = block.fields.map((f) => {
    let allowed = f.options?.length ? f.options.map((o) => code(o.value === '' ? '""' : o.value)).join(', ') : '-';
    if (f.optionsFrom) {
      const refs = (f.optionsFrom.sources ?? [{ input: f.optionsFrom.input!, value: f.optionsFrom.value! }])
        .map((s) => `a ${code(s.value)} from ${code(s.input)}`);
      allowed = `${refs.join(' or ')}${f.optionsFrom.freeText ? ', or a new name' : ''}`;
    }
    const about = [f.label, firstSentence(f.help)].filter(Boolean).join(': ');
    return `| ${code(f.id)} | ${f.type ?? (f.optionsFrom ? 'reference' : 'text')} | ${value(f.default)} | `
      + `${cell(about)} | ${allowed} | ${shownWhen(f, types)} |`;
  });
  return ['| Field | Type | Default | What it does | Allowed values | Shown in the editor when |', '|---|---|---|---|---|---|', ...rows].join('\n');
}

function exportsTable(m: DiagramManifest): string {
  const formats = m.render.formats;
  sameKeys('export', EXPORT_NOTES, formats);
  const rows = formats.map((f) => {
    const cli = NODE_FORMATS.includes(f) ? 'Yes'
      : f === 'png' ? 'Yes, for a plain PNG (no bleed, marks or durable credential)' : 'No: browser tier';
    return `| ${code(f)} | ${cli} | ${EXPORT_NOTES[f]} |`;
  });
  return [
    `Declared formats, in manifest order. The render frame is ${m.render.width} × ${m.render.height} px.`,
    '',
    '| Format | Without a browser on the CLI | What the file holds |',
    '|---|---|---|',
    ...rows,
  ].join('\n');
}

/** Every generated block of reference/diagrams.md, by marker name. */
export function diagramBlocks(manifest: DiagramManifest): Record<string, string> {
  return {
    'diagram-sources': sourcesTable(manifest),
    'diagram-source-syntax': sourceSyntax(manifest),
    'diagram-types': typesTable(manifest),
    'diagram-looks': looksTable(manifest),
    'diagram-defaults': defaultsTable(manifest),
    'diagram-look-controls': lookControls(manifest),
    'diagram-card-fields': fieldTable(manifest, 'nodes'),
    'diagram-connection-fields': fieldTable(manifest, 'arrows'),
    'diagram-group-fields': fieldTable(manifest, 'layers'),
    'diagram-exports': exportsTable(manifest),
  };
}

/** The bodies of the `<!-- SHARE:name -->` blocks in a reference file. */
export function sharedBlocks(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of text.matchAll(/<!-- SHARE:([a-z0-9-]+) -->\n([\s\S]*?)\n<!-- \/SHARE:\1 -->/g)) {
    const [, name, body] = match as unknown as [string, string, string];
    if (/<!-- \/?(?:GEN|SHARE):/.test(body)) throw new Error(`gen-agent-skill: SHARE:${name} contains another marker`);
    if (name in out) throw new Error(`gen-agent-skill: SHARE:${name} appears twice`);
    out[name] = body;
  }
  return out;
}

/**
 * Fill every `<!-- GEN:name -->` marker in the tool skill's workflow with the
 * generated table or shared block of that name. An unknown name stops the run.
 */
export function workflowBlocks(workflow: string, tables: Record<string, string>, shared: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [, name] of workflow.matchAll(/<!-- GEN:([a-z0-9-]+) -->/g) as Iterable<[string, string]>) {
    const body = tables[name] ?? shared[name];
    if (body === undefined) throw new Error(`gen-agent-skill: workflow.md asks for GEN:${name}, which diagrams.md does not provide`);
    out[name] = body;
  }
  return out;
}
