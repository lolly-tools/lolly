# Plan: adding colours to the brand from where they appear (2026-09-06)

Blend and ramp step swatches in the start colour view should carry a "+" that adds the colour to the brand.

File references: `lolly-web` at `45ee61a`.

## 1. What exists

- Blend swatches in the brand editor's Colours room are `<span>`s with a title and no action (`lib/brand-editor.ts:417-430`, `blendRow`, built with `rampOklab([a, b], steps, { correctLightness: true })`). Ramp steps are buttons only where a step can be selected as the driver (`rampRow`, `:388-414`).
- In the Colour Lab (`views/color-lab.ts`), blend stops copy to the clipboard by design (`:2004-2013`, `:2808-2818`; the section note at `:3469` says "Click a stop to copy it"). The Lab reads the brand (`.lab-brand-rail`, `:3301`) and never writes it.
- The sanctioned write path exists: `BrandEditorHandle.addColors(entries)` (`lib/brand-editor.ts:1103`, implemented as `addColorEntries` at `:4519-4535`) writes into the live document the editor holds and persists once per batch; absent on a locked build; the first colour into an empty room becomes the primary. `views/start.ts:1341` bridges it as `addColorsToSystem` for the tray. Underneath, `addSwatch(doc, group, name, hex)` in `lib/brand-doc.ts:385-406` slugs and tags the leaf.
- The user-facing add control is `mountAddColor` (`lib/design-system/add-color.ts:217`), whose contract says the eyedropper fills the field and does not add; the Add button adds.

## 2. Design

1. **Brand editor (cheap, same file as the write path).** `blendRow` and `rampRow` render every cell as a button with a small "+" corner mark, shown on hover and always on coarse pointers. Click calls `addColorEntries([{ hex, name }])` with `name` "Blend 3" or "Neutral step 4" and flashes the cell; a second click on an already-added colour is a no-op with a tick. Cells that are already in the palette show the tick from the start (`brand-doc.ts` can answer "is this hex a swatch" in one scan).
2. **Colour Lab.** Add an "Add to brand" action beside Copy on blend stops (`stepHtml` gains an `'add'` action, handler beside `:2818`) when a handle is available; give the Lab the write seam through the same `addColorsToSystem` the tray uses. Tone steps keep re-seeding the report; only blend stops add. The section note is updated.
3. **Locked builds.** No "+" when `addColors` is absent; the cells stay plain.
4. **Naming.** Editable afterwards in the Colours room like any custom swatch; the name records the source ("Blend 3 of Primary and Secondary") so a later reader knows where it came from.

## 3. Tests

`lib/brand-editor.test.ts`: `blendRow` and `rampRow` markup, one `addColorEntries` call per tap, the tick state, no "+" on a locked handle. `views/color-lab.test.ts`: the add action calls the seam once and Copy still copies.

## 4. Size

S. Repo: `lolly-web`. Independent of the profile merge; the hero's APCA ink is in the profile plan.
