// SPDX-License-Identifier: MPL-2.0
/** Bounded colour, spacing and modular type recipes. */
import { hexToOklch, mixOklch, oklchToHex } from './brand-derive.ts';
import { TOKEN_EXT } from './token-ext.ts';
import { tokenSetNames } from './token-selection.ts';
import { canonicalJson } from './canonical-json.ts';

export interface TokenRecipe {
  id: string;
  version: 1;
  kind: 'spacing' | 'type' | 'color';
  prefix: string;
  set?: string;
  count: number;
  base: number;
  ratio: number;
  seed?: string;
  overrides?: Record<string, unknown>;
}
export interface TokenRecipeRecord extends TokenRecipe { paths: string[]; outputs: Record<string, unknown> }
type Rec = Record<string, unknown>;
const record = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);

export function readTokenRecipes(doc: unknown): TokenRecipeRecord[] {
  const ext = record(doc) && record(doc.$extensions) ? doc.$extensions[TOKEN_EXT] : null;
  return record(ext) && Array.isArray(ext.recipes) ? ext.recipes.slice(0, 64).filter(r => record(r) && r.version === 1 && ['spacing', 'type', 'color'].includes(String(r.kind)) && typeof r.id === 'string' && typeof r.prefix === 'string' && Array.isArray(r.paths) && record(r.outputs)).map(r => structuredClone(r) as unknown as TokenRecipeRecord) : [];
}
const safePath = (path: string): string[] => {
  const parts = path.split('.');
  if (!parts.length || parts.length > 16 || parts.some(p => !/^[a-zA-Z0-9_-]+$/.test(p) || ['__proto__', 'constructor', 'prototype'].includes(p))) throw new Error('Use a dotted token path with letters, numbers, hyphens or underscores.');
  return parts;
};

/** Registered local recipes materialize ordinary DTCG tokens for older readers. */
export function generateTokenRecipe(source: unknown, recipe: TokenRecipe, options: { clearOverrides?: string[] } = {}): Record<string, unknown> {
  if (!record(source)) throw new Error('A token document is required.');
  if (recipe.version !== 1 || !['spacing', 'type', 'color'].includes(recipe.kind)) throw new Error('Unknown recipe or recipe version.');
  if (!recipe.id || recipe.id.length > 128 || !Number.isInteger(recipe.count) || recipe.count < 2 || recipe.count > 32) throw new Error('Recipes need an id and between 2 and 32 steps.');
  if (!Number.isFinite(recipe.base) || recipe.base <= 0 || recipe.base > 10000 || !Number.isFinite(recipe.ratio) || recipe.ratio < 1 || recipe.ratio > 4) throw new Error('Choose a positive base up to 10000 and a ratio from 1 to 4.');
  const prefix = safePath(recipe.prefix);
  const sets = tokenSetNames(source);
  if (sets && (!recipe.set || !sets.includes(recipe.set))) throw new Error('Choose an existing source set for generated tokens.');
  const doc = structuredClone(source);
  const ext = record(doc.$extensions) ? doc.$extensions : {};
  const vendor = record(ext[TOKEN_EXT]) ? ext[TOKEN_EXT] : {};
  const recipes = Array.isArray(vendor.recipes) ? vendor.recipes.filter(record) : [];
  if (recipes.length >= 64 && !recipes.some(r => r.id === recipe.id)) throw new Error('This document already has 64 recipes.');
  const previous = recipes.find(r => r.id === recipe.id);
  if (previous && (previous.prefix !== recipe.prefix || previous.set !== recipe.set || previous.kind !== recipe.kind)) throw new Error('Keep the recipe path, set and kind stable when regenerating.');
  if (previous && (!Array.isArray(previous.paths) || previous.paths.length > 32 || previous.paths.some(p => typeof p !== 'string' || !/^([1-9]|[12]\d|3[0-2])$/.test(p.slice(recipe.prefix.length + 1)) || !p.startsWith(`${recipe.prefix}.`)))) throw new Error('The stored recipe ownership record is invalid.');
  let root = sets ? doc[recipe.set!] as Rec : doc;
  for (const part of prefix) {
    if (root[part] === undefined) root[part] = {};
    if (!record(root[part]) || '$value' in root[part]) throw new Error('The recipe path collides with an existing token.');
    root = root[part] as Rec;
  }
  const seed = recipe.kind === 'color' ? hexToOklch(recipe.seed ?? '') : null;
  if (recipe.kind === 'color' && (!/^#[0-9a-f]{6}$/i.test(recipe.seed ?? '') || !seed)) throw new Error('Choose a six-digit hex colour for the ramp.');
  const paths: string[] = [];
  const outputs: Record<string, unknown> = {};
  const overrides: Record<string, unknown> = { ...(record(previous?.overrides) ? previous.overrides : {}), ...recipe.overrides };
  const clear = new Set(options.clearOverrides ?? []);
  if (clear.size > 32 || [...clear].some(path => !Array.isArray(previous?.paths) || !previous.paths.includes(path))) throw new Error('Only existing recipe outputs can restore their generated value.');
  for (const path of clear) delete overrides[path];
  for (let i = 0; i < recipe.count; i++) {
    const key = String(i + 1), path = `${recipe.prefix}.${key}`;
    if (root[key] !== undefined && !(Array.isArray(previous?.paths) && previous.paths.includes(path))) throw new Error(`Recipe output ${path} already belongs to a manual token.`);
    const step = Math.round((recipe.kind === 'spacing' ? recipe.base * i : recipe.base * recipe.ratio ** i) * 10000) / 10000;
    if (step > 1000000) throw new Error('The generated scale exceeds the supported size.');
    const value = recipe.kind === 'color'
      ? oklchToHex(mixOklch(i < (recipe.count - 1) / 2 ? { l: 1, c: 0, h: seed!.h } : seed!, i < (recipe.count - 1) / 2 ? seed! : { l: 0, c: 0, h: seed!.h }, i < (recipe.count - 1) / 2 ? i / ((recipe.count - 1) / 2) : (i - (recipe.count - 1) / 2) / ((recipe.count - 1) / 2)))
      : { value: step, unit: 'px' };
    const current = record(root[key]) ? root[key] : null;
    if (!clear.has(path) && current && record(previous?.outputs) && canonicalJson(current.$value) !== canonicalJson(previous.outputs[path])) overrides[path] = current.$value;
    outputs[path] = value;
    root[key] = { ...(current ?? {}), $type: recipe.kind === 'color' ? 'color' : 'dimension', $value: Object.hasOwn(overrides, path) ? overrides[path] : value };
    paths.push(path);
  }
  // Removed generated steps are removed only if still owned by this recipe.
  if (Array.isArray(previous?.paths)) for (const path of previous.paths) if (typeof path === 'string' && !paths.includes(path)) {
    const key = path.split('.').at(-1)!, current = root[key];
    if (!clear.has(path) && record(current) && record(previous.outputs) && canonicalJson(current.$value) !== canonicalJson(previous.outputs[path])) overrides[path] = current.$value;
    if (!Object.hasOwn(overrides, path)) delete root[key];
  }
  const retained = Array.isArray(previous?.paths) ? previous.paths.filter((path): path is string => typeof path === 'string' && !paths.includes(path) && Object.hasOwn(overrides, path)) : [];
  for (const path of retained) if (record(previous?.outputs)) outputs[path] = previous.outputs[path];
  doc.$extensions = { ...ext, [TOKEN_EXT]: { ...vendor, recipes: [...recipes.filter(r => r.id !== recipe.id), { ...structuredClone(recipe), paths: [...paths, ...retained], outputs, overrides }] } };
  return doc;
}
