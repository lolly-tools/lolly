// SPDX-License-Identifier: MPL-2.0
/**
 * `canvas.*Field` → sub-field-id existence checking (plans/104 §9.2 M0-D).
 *
 * A free-canvas block declares its geometry by NAMING sub-fields:
 * `canvas.xField: "x"` means "the box's left edge lives in the `x` sub-field of
 * this same blocks input". Nothing at runtime notices when that name is wrong —
 * the overlay's `setField` no-ops on a field the row doesn't carry, and the
 * compact blocks URL drops an undeclared sub-field on the way out. So a typo'd
 * `shadowBlrField` (or a rename that missed the canvas block) ships as a control
 * that silently does nothing, in a manifest that validates cleanly.
 *
 * The JSON Schema owns the other half — `canvas` is a CLOSED set, so an unknown
 * key is an Ajv error. It cannot own this half: whether `"x"` names a real field
 * depends on the sibling `fields` array, which JSON Schema has no way to
 * cross-reference. Hence a structural check here, in the same class as the
 * validator's other "the schema can't express this" invariants.
 *
 * Two scopes, because `canvas` carries two kinds of field reference:
 *
 *   - TOP-LEVEL `*Field` keys point at sub-fields of the canvas's OWN input.
 *   - `canvas.connect.*Field` keys point at sub-fields of the SEPARATE blocks
 *     input named by `connect.input` (the connector-edge array), so they resolve
 *     against that input's `fields`, and a `connect.input` naming no input at
 *     all is itself an error.
 *
 * Keys that are NOT field references — `frameKind` (a literal `kind` VALUE),
 * `pathLayerClass`, `minSize`, `grid`, `fixedCanvas`, `addKinds`, `import` — do
 * not end in `Field`, which is exactly why the `/Field$/` rule is safe to apply
 * mechanically. `connect.layerClass` and the `default*` seeds are excluded by
 * the same rule.
 *
 * Pure and side-effect-free: takes a parsed manifest, returns messages. The
 * caller (scripts/validate-catalog.ts) prefixes each with its tool dir, and
 * tests/canvas-schema-contract.test.ts drives it directly.
 */

/** A manifest input, as far as this check cares. */
interface BlocksInput {
  id?: unknown;
  fields?: Array<{ id?: unknown }>;
  canvas?: Record<string, unknown>;
}
interface Manifest {
  inputs?: BlocksInput[];
}

/** True for a canvas key whose VALUE is a sub-field id (the `/Field$/` rule). */
export function isFieldRefKey(key: string): boolean {
  return /Field$/.test(key);
}

const CONNECT_KEY = 'connect';

/**
 * Every `canvas.*Field` in `manifest` that names no real sub-field.
 *
 * Returns one message per broken reference (dir prefix left to the caller);
 * an empty array means every reference resolves. A non-string or empty value is
 * reported too — a `*Field` is a field NAME, and `null`/`0`/`""` can only be a
 * mistake in a hand-edited manifest.
 */
export function canvasFieldRefErrors(manifest: Manifest): string[] {
  const out: string[] = [];
  const inputs = Array.isArray(manifest?.inputs) ? manifest.inputs : [];
  for (const input of inputs) {
    const canvas = input?.canvas;
    if (!canvas || typeof canvas !== 'object' || Array.isArray(canvas)) continue;
    const inputId = typeof input.id === 'string' ? input.id : '?';
    const ownIds = fieldIds(input);

    for (const [key, value] of Object.entries(canvas)) {
      if (!isFieldRefKey(key)) continue;
      if (typeof value !== 'string' || !value) {
        out.push(
          `input "${inputId}" canvas.${key} must be the id of a sub-field (a non-empty string), got ${JSON.stringify(value)}`,
        );
        continue;
      }
      if (!ownIds.has(value)) {
        out.push(
          `input "${inputId}" canvas.${key} names "${value}", which is not an id in that input's fields ` +
          `(${describe(ownIds)}) — the control would read a sub-field nothing writes`,
        );
      }
    }

    // The connector-edge array is a DIFFERENT input, so its field references
    // resolve there. (No shipped manifest declares `connect` today; the check
    // exists so the first one that does can't quietly mis-name a field.)
    const connect = (canvas as Record<string, unknown>)[CONNECT_KEY];
    if (!connect || typeof connect !== 'object' || Array.isArray(connect)) continue;
    const target = String((connect as { input?: unknown }).input ?? '');
    const targetInput = inputs.find((i) => i?.id === target);
    if (!targetInput) {
      out.push(`input "${inputId}" canvas.connect.input names "${target}", which is not an input of this tool`);
      continue;
    }
    const edgeIds = fieldIds(targetInput);
    for (const [key, value] of Object.entries(connect as Record<string, unknown>)) {
      if (!isFieldRefKey(key)) continue;
      if (typeof value !== 'string' || !value) {
        out.push(
          `input "${inputId}" canvas.connect.${key} must be the id of a sub-field (a non-empty string), got ${JSON.stringify(value)}`,
        );
        continue;
      }
      if (!edgeIds.has(value)) {
        out.push(
          `input "${inputId}" canvas.connect.${key} names "${value}", which is not an id in input "${target}"'s fields ` +
          `(${describe(edgeIds)})`,
        );
      }
    }
  }
  return out;
}

function fieldIds(input: BlocksInput): Set<string> {
  const ids = new Set<string>();
  for (const f of Array.isArray(input?.fields) ? input.fields : []) {
    if (f && typeof f.id === 'string' && f.id) ids.add(f.id);
  }
  return ids;
}

/** A short, bounded rendering of the available ids — enough to spot the typo. */
function describe(ids: Set<string>): string {
  const all = [...ids];
  if (!all.length) return 'the input declares no fields';
  const head = all.slice(0, 12).join(', ');
  return all.length > 12 ? `${head}, … ${all.length} in total` : head;
}
