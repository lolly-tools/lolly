// SPDX-License-Identifier: MPL-2.0
/**
 * Which theme choices change what a tool draws (plans/319 decision 9).
 *
 * The tool sidebar's Design system section offers a group (light and dark, a
 * colourway, any other) only when switching between its options changes this
 * tool's output: the colours the tool resolves differ between the options. Those
 * colours are the canvas variables its markup and styles name (`--brand-primary`,
 * `--brand-token-…`) and the token references its inputs link or its hooks name.
 * A utility that draws no design-system colour shows no light and dark switch,
 * and a colourway that re-points only colours the tool never reads shows no dots.
 *
 * What a tool reads is worked out from its sources, so every doubt falls on the
 * side of showing the control:
 *  - a hook that reads the design system as a whole (the colour list, the token
 *    set, a reference built from a variable) counts as reading every token;
 *  - a reference a hook builds on a fixed start (`'{asset.logo.' + variant + '}'`)
 *    counts as every token under that start;
 *  - module hooks, a composed tool and a tool link in the document count as
 *    reading every token, because what they draw is not in these sources;
 *  - a treated picture counts as changing with every choice, because a photo look
 *    can keep a variant per theme that no token read shows.
 * Pure: no DOM, so the tests and the controller run the same code.
 */
import type { TokenSet } from '@lolly-tools/core/host-v1';

/** What a tool's output reads from the design system, as far as its sources show. */
export interface ToolTokenUsage {
  /** Token paths the output reads, sorted: `color.semantic.primary`. */
  paths: string[];
  /** Path starts a hook builds references on, sorted: every token under one counts. */
  prefixes: string[];
  /** The tool reads the design system as a whole: every token counts. */
  all: boolean;
  /** The output can follow a choice in a way no token shows (a treated picture):
   *  every group with more than one option is offered. */
  any: boolean;
}

/** The parts of a loaded tool this module reads (engine `LoadedTool` fits). */
export interface ToolSources {
  template?: string | null;
  styles?: string | null;
  hooksSource?: string | null;
  hooksUrl?: string | null;
  presentationSource?: string | null;
  manifest?: { composes?: readonly unknown[] | null } | null;
}

/** Past this many distinct references the list stops paying for itself. */
const MAX_PATHS = 2000;

const EMPTY: ToolTokenUsage = { paths: [], prefixes: [], all: false, any: false };

/** A `--brand-<name>` canvas variable, named in full. */
const BRAND_VAR = /--brand-([a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9])/gi;
/** A `--brand-` name finished at run time (`'--brand-' + slot`): every colour counts. */
const DYNAMIC_BRAND_VAR = /--brand-(?:token-)?(?=['"`]|\$\{)/;
/** A token reference written in full, as a model value or inside a JSON string. */
const REFERENCE = /\{([^{}"'\\\s][^{}"'\\\n]{0,199})\}/g;
/** A tool link in the embed form, which the shell renders in the document's choice. */
const TOOL_EMBED = /\/tool\/[a-z0-9-]+\.(?:svg|png|jpe?g|webp|avif|gif|pdf)\b/i;
/** A treated picture (`<asset>?treatment=<look>`), whose look may keep a variant per theme. */
const TREATED = /\?treatment=/;

/** The token path a `--brand-*` name paints from (brand-vars.ts SLOTS, brand-faces.ts). */
export function brandVarPath(name: string): string | null {
  if (name.startsWith('token-')) {
    const hex = name.slice(6);
    if (!hex || hex.length % 2 || !/^[0-9a-f]+$/i.test(hex)) return null;
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) || null; } catch { return null; }
  }
  return `color.semantic.${name}`;
}

/** The token paths every `--brand-*` variable in `text` paints from. */
function brandVarPaths(text: string, into: Set<string>): void {
  for (const match of text.matchAll(BRAND_VAR)) {
    const path = brandVarPath(match[1]!.toLowerCase());
    if (path) into.add(path);
  }
}

/**
 * What a classic hooks.js reads from `host.tokens`. Only hooks that touch the
 * tokens at all contribute references, so a hook that builds CSS from `'{'` and
 * never reads a token adds nothing.
 *
 * A hook that only calls `resolve` reads what its string literals name: a whole
 * reference (`'{font.brand}'`, or the bare `'color.semantic.primary'` that
 * resolve also accepts), or the fixed start of one finished at run time
 * (`'{asset.logo.' + variant`). Every such literal counts, whichever call it
 * reaches, so a reference kept in a variable first is counted too. A reference
 * built from nothing fixed (`'{' + path`) reads anything.
 */
function hookUsage(source: string): ToolTokenUsage {
  const members = [...source.matchAll(/\.tokens\s*\??\.\s*([A-Za-z_$][\w$]*)/g)].map((m) => m[1]!);
  // `host.tokens` handed on whole (assigned, passed, returned): what reads it is unknown.
  const handedOn = /\.tokens\s*(?:[;,}\]]|:(?!:)|\)\s*[;,.)\]?:])/.test(source);
  if (!members.length && !handedOn) return EMPTY;
  if (handedOn || members.some((member) => member !== 'resolve' && member !== 'themes')) return { ...EMPTY, all: true };
  const paths = new Set<string>();
  const prefixes = new Set<string>();
  // A quoted string that opens a reference, then what follows its closing quote: a `+`
  // (or a `${` inside a template string) means the rest is built at run time.
  for (const literal of source.matchAll(/(['"`])\{([A-Za-z0-9_$.\- ]*)(\})?(?:\1(\s*\+)?|(\$\{))/g)) {
    const body = literal[2]!.trim();
    const built = Boolean(literal[4] || literal[5]);
    if (literal[3]) { if (body) paths.add(body); continue; }
    if (body) { prefixes.add(body); continue; }
    if (built) return { ...EMPTY, all: true };
  }
  // A dotted path written without braces, which resolve takes as it is.
  for (const literal of source.matchAll(/(['"`])([A-Za-z][\w-]*(?:\.[\w-]+)+)(\.)?(?:\1(\s*\+)?|(\$\{))/g)) {
    if (literal[3] || literal[4] || literal[5]) prefixes.add(literal[2]! + (literal[3] ?? ''));
    else paths.add(literal[2]!);
  }
  if (paths.size > MAX_PATHS || prefixes.size > MAX_PATHS) return { ...EMPTY, all: true };
  return { paths: [...paths].sort(), prefixes: [...prefixes].sort(), all: false, any: false };
}

function merge(a: ToolTokenUsage, b: ToolTokenUsage): ToolTokenUsage {
  if (a.any || b.any) return { ...EMPTY, any: true };
  if (a.all || b.all) return { ...EMPTY, all: true };
  const paths = [...new Set([...a.paths, ...b.paths])].sort();
  if (paths.length > MAX_PATHS) return { ...EMPTY, all: true };
  return { paths, prefixes: [...new Set([...a.prefixes, ...b.prefixes])].sort(), all: false, any: false };
}

const sourceCache = new WeakMap<object, ToolTokenUsage>();

/** What a tool reads before any input has a value: its markup, styles and hooks. */
export function sourceTokenUsage(tool: ToolSources): ToolTokenUsage {
  const cached = sourceCache.get(tool);
  if (cached) return cached;
  let usage: ToolTokenUsage;
  if (tool.hooksUrl && !tool.hooksSource) usage = { ...EMPTY, all: true };
  else if (tool.manifest?.composes?.length) usage = { ...EMPTY, all: true };
  else {
    const markup = [tool.template, tool.styles, tool.presentationSource].filter((s): s is string => typeof s === 'string').join('\n');
    const hooks = tool.hooksSource ?? '';
    if (DYNAMIC_BRAND_VAR.test(markup) || DYNAMIC_BRAND_VAR.test(hooks) || TOOL_EMBED.test(markup)) usage = { ...EMPTY, all: true };
    else {
      const paths = new Set<string>();
      brandVarPaths(markup, paths);
      brandVarPaths(hooks, paths);
      usage = merge({ ...EMPTY, paths: [...paths].sort() }, hooks ? hookUsage(hooks) : EMPTY);
    }
  }
  sourceCache.set(tool, usage);
  return usage;
}

/** What the inputs' current values read: the references they link (a linked colour
 *  is `{ ref: '{color.semantic.primary}', … }`, and a block or a text document
 *  keeps its links as JSON inside a string) and any `var(--brand-…)` they hold. */
export function valueTokenUsage(values: unknown): ToolTokenUsage {
  let text: string;
  try { text = JSON.stringify(values) ?? ''; } catch { return { ...EMPTY, all: true }; }
  if (!text) return EMPTY;
  if (TREATED.test(text)) return { ...EMPTY, any: true };
  if (TOOL_EMBED.test(text) || DYNAMIC_BRAND_VAR.test(text)) return { ...EMPTY, all: true };
  const paths = new Set<string>();
  for (const match of text.matchAll(REFERENCE)) {
    paths.add(match[1]!.trim());
    if (paths.size > MAX_PATHS) return { ...EMPTY, all: true };
  }
  brandVarPaths(text, paths);
  return { ...EMPTY, paths: [...paths].sort() };
}

/** What a mounted tool reads now: its sources, then its inputs' values. */
export function toolTokenUsage(tool: ToolSources, model?: ReadonlyArray<{ value?: unknown }> | null): ToolTokenUsage {
  const fromSources = sourceTokenUsage(tool);
  if (fromSources.all || fromSources.any || !model) return fromSources;
  return merge(fromSources, valueTokenUsage(model.map((item) => item.value)));
}

/** A stable key: two usages with the same key read the same tokens. */
export function tokenUsageKey(usage: ToolTokenUsage | null | undefined): string {
  if (!usage) return 'none';
  if (usage.any) return 'any';
  if (usage.all) return 'all';
  return JSON.stringify([usage.paths, usage.prefixes]);
}

/** Canonical JSON (keys sorted), so two equal token values print alike. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    return `{${Object.keys(rec).sort().filter((k) => rec[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical(rec[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** Everything `usage` reads from one resolved token set, as one string. Two options
 *  that give the same string draw the tool the same. */
export function tokenFingerprint(set: TokenSet, usage: ToolTokenUsage): string {
  if (usage.all || usage.any) return set.query().map((entry) => `${entry.path}=${canonical(entry.value)}`).sort().join('\n');
  const parts = usage.paths.map((path) => `${path}=${canonical(set.resolve(path))}`);
  if (usage.prefixes.length) {
    const entries = set.query();
    for (const prefix of usage.prefixes) {
      for (const entry of entries) if (entry.path.startsWith(prefix)) parts.push(`${entry.path}=${canonical(entry.value)}`);
    }
  }
  return parts.join('\n');
}

/**
 * Whether choosing between `options` changes what the tool draws. `setFor` gives the
 * token set each option resolves to, with every other group on its choice in force.
 * A usage that reads nothing changes with nothing; `any` changes with everything.
 */
export function optionsChangeOutput(options: readonly string[], usage: ToolTokenUsage, setFor: (option: string) => TokenSet): boolean {
  if (options.length < 2) return false;
  if (usage.any) return true;
  if (!usage.all && !usage.paths.length && !usage.prefixes.length) return false;
  const first = tokenFingerprint(setFor(options[0]!), usage);
  return options.slice(1).some((option) => tokenFingerprint(setFor(option), usage) !== first);
}
