// SPDX-License-Identifier: MPL-2.0
/**
 * What Rebuild palette keeps from a document's root `$extensions`.
 *
 * A rebuild replaces colours. The root record holds other people's choices and this
 * head's history: house rules and vocabulary, share cards, the emoji choice and its
 * assets, the list of published versions, the design system's identity, the file it
 * came from, recipes, and any other vendor's record. A fresh derive holds none of that, so the
 * rebuilt document takes it from the one it replaces.
 *
 * Four keys stay as the rebuild left them, because the rebuild decides each one:
 * `excluded` keeps only swatches that still exist, `paletteOrder` and `paletteGroups`
 * come across through `carryPaletteGroups`, and `themeAxes` describes the rebuilt
 * document's themes, not the old one's.
 *
 * The brand page address (`exportRecord`) comes across with the rest and stays under
 * `settleBrandPageWrite`, which every write of a head goes through: the head's own
 * setting stands whatever this document holds, so this copy can neither add an address
 * nor lose one.
 *
 * A token file is untrusted, so a key that names part of the object model is left out.
 * Nothing here looks inside a value: a record that does not validate stays as it was.
 */
import { TOKEN_EXT } from '@lolly/engine';

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

const REBUILD_DECIDES: ReadonlySet<string> = new Set(['excluded', 'paletteOrder', 'paletteGroups', 'themeAxes']);
const OBJECT_MODEL: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Copy what `to` lacks from `from`'s root `$extensions`. `to` is changed in place. A key
 * `to` already holds wins: the rebuild carried it on purpose. A document with no root
 * `$extensions` adds nothing, so a plain rebuild stays exactly the fresh derive.
 */
export function carryRootExtensions(from: unknown, to: Rec): void {
  if (!isRec(from) || !isRec(from.$extensions)) return;
  for (const [vendor, value] of Object.entries(from.$extensions)) {
    if (OBJECT_MODEL.has(vendor)) continue;
    const holds = isRec(to.$extensions) && Object.hasOwn(to.$extensions, vendor) ? to.$extensions[vendor] : undefined;
    if (vendor === TOKEN_EXT && isRec(value) && (holds === undefined || isRec(holds))) {
      const keys = Object.keys(value).filter(key => !REBUILD_DECIDES.has(key) && !OBJECT_MODEL.has(key) && !(isRec(holds) && Object.hasOwn(holds, key)));
      if (!keys.length) continue;
      const target = recordAt(to, vendor);
      for (const key of keys) target[key] = structuredClone(value[key]);
    } else if (holds === undefined) {
      if (!isRec(to.$extensions)) to.$extensions = {};
      (to.$extensions as Rec)[vendor] = structuredClone(value);
    }
  }
}

/** `to.$extensions[vendor]`, created as a record when it is absent. */
function recordAt(to: Rec, vendor: string): Rec {
  if (!isRec(to.$extensions)) to.$extensions = {};
  const ext = to.$extensions as Rec;
  if (!Object.hasOwn(ext, vendor)) ext[vendor] = {};
  return ext[vendor] as Rec;
}
