// SPDX-License-Identifier: MPL-2.0
/**
 * Build the hash route that opens a tool SEEDED with a specific example look's inputs - 
 * the `#/tool/<id>?<query>` a hand-made share of that look would produce. The query is the
 * engine-owned encoding (buildInputModel → serializeUrlState), so `parseUrlState` in the
 * tool view seeds the identical inputs the look rendered from. Only the look's OWN inputs
 * (`isDirty`) ride the URL - defaults stay implicit, so the link reads like a share, not a
 * dump of every input.
 *
 * Shared by the gallery tile carousels (`openExample`) and the cinematic featured row
 * (`components/featured-row.ts`) so a click on a look you're watching lands in that exact
 * style in EITHER surface - and the two can never drift on how that URL is built. Engine +
 * loader are imported lazily to stay off the gallery's boot chunk; any failure falls back to
 * the tool's blank-session route.
 */
import type { InputValue } from '../../../../engine/src/inputs.ts';

export async function toolSeedHref(
  toolId: string,
  values: Record<string, unknown> | undefined | null,
): Promise<string> {
  const base = `#/tool/${toolId}`;
  if (!values) return base;
  try {
    const [{ getTool }, { buildInputModel, serializeUrlState }] = await Promise.all([
      import('../bridge/tool-loader.ts'),
      import('@lolly/engine'),
    ]);
    const { manifest } = await getTool(toolId);
    const query = serializeUrlState(
      buildInputModel(manifest, { initial: values as Record<string, InputValue> }).filter((m) => m.isDirty),
    );
    return query ? `${base}?${query}` : base;
  } catch {
    return base; // manifest failed to load - open a blank session
  }
}
