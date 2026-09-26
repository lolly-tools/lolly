// SPDX-License-Identifier: MPL-2.0
import { existsSync, readFileSync } from 'node:fs';

/** Read on each build so the docs watcher sees regenerated diagram links. */
export function diagramRecipes(): Record<string, { route: string }> {
  const path = new URL('./diagrams/document-model/recipes.json', import.meta.url);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
}
