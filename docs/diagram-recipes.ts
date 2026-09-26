// SPDX-License-Identifier: MPL-2.0
import { existsSync, readdirSync, readFileSync } from 'node:fs';

/**
 * The "Open this in Diagram Builder" recipes of every figure set under docs/diagrams/
 * (scripts/build-spec-diagrams.ts writes one recipes.json per set). Read on each build
 * so the docs watcher sees regenerated diagram links.
 */
export function diagramRecipes(): Record<string, { route: string }> {
  const root = new URL('./diagrams/', import.meta.url);
  if (!existsSync(root)) return {};
  const out: Record<string, { route: string }> = {};
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = new URL(`./${entry.name}/recipes.json`, root);
    if (existsSync(path)) Object.assign(out, JSON.parse(readFileSync(path, 'utf8')));
  }
  return out;
}
