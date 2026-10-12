// SPDX-License-Identifier: MPL-2.0
/** Native MCP and web images must expose the complete same-source recipe catalog. */
import assert from 'node:assert/strict';

type Recipe = { id: string };

/** The source-built web index fixes both the count and ordered IDs for this image. */
export function assertNativeCatalogClosure(recipes: Recipe[], webRecipes: Recipe[]): void {
  assert.ok(Array.isArray(recipes) && Array.isArray(webRecipes));
  assert.ok(webRecipes.length > 0, 'The reviewed public web catalog must not be empty');
  const ids = (entries: Recipe[]) => entries.map((entry) => {
    assert.ok(entry && typeof entry.id === 'string' && entry.id.length > 0);
    return entry.id;
  });
  const actual = ids(recipes);
  const expected = ids(webRecipes);
  assert.equal(new Set(expected).size, expected.length, 'Public web recipe IDs must be unique');
  assert.equal(new Set(actual).size, actual.length, 'MCP recipe IDs must be unique');
  assert.equal(recipes.length, webRecipes.length, 'Every same-source public web recipe must be present in MCP');
  assert.deepEqual(actual, expected);
}
