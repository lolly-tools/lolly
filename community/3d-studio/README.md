# 3D Studio

Studio for extruded SVG artwork and GLB/STL/3MF product imagery, alone, as a collection of separate photographs, or arranged together in one scene.

[User guide](../../docs/3d-studio.md)

The manifest supplies Guided and Expert views over the same saved inputs. Hooks resolve asset references and emit an escaped versioned data marker. They do not own a GPU context or load Three.js.

- `engine/src/studio3d.ts`: portable recipe normalization and turntable time.
- `engine/src/studio3d-collection.ts`: shared collection evaluation, per-item framing and deterministic output names.
- `engine/src/studio3d-arrangement.ts`: several objects in one scene, with stable ids, selection, numerical edits, overlap guidance and the footprint pivot.
- `engine/src/studio3d-lights.ts`: light placement math (orbit about the subject, distance) and where a moved light is saved for preset and custom rigs.
- `packages/core/src/studio3d-v1.ts`: shared scene types.
- `shells/web/src/lib/studio3d/`: retained source, material, lighting, environment, camera and capture implementation. Objects that name the same bytes share one loaded asset; `environment.ts` generates the studio, soft box and window environments and decodes imported `.hdr`/`.exr` radiance maps. `inset.ts` repeats the inset three.js draws for a bevel, so the bevel check tests the outline that is rendered. `scene-host.ts` names the renderer contract that `StudioRenderer` implements.
- Editor, multi-edit and batch/composition mount the same shell renderer. Exports await a successful render and re-render at the export's pixel size (the frame clock's third argument). `shells/web/src/bridge/frame-clock.ts` keeps a clip's length and size for every clock call in one capture. While a capture runs, the studio holds its frame: previews, gestures and input updates wait. A frame that fails to render fails the export.

The existing `3d` tool keeps its own tool identity and saved sessions.

Run the scene and material tests with:

```sh
node --import ./tests/css-stub.mjs --test tests/studio3d.test.ts tests/studio3d-materials.test.ts tests/studio3d-collection.test.ts tests/studio3d-arrangement.test.ts tests/studio3d-environment.test.ts
node --import ./tests/css-stub.mjs --test tests/studio3d-recipe-compat.test.ts tests/studio3d-material-compat.test.ts
node --import ./tests/css-stub.mjs --test tests/studio3d-geometry.test.ts tests/studio3d-geometry-fixtures.test.ts tests/studio3d-inset.test.ts tests/studio3d-tessellation.test.ts
node --import ./tests/css-stub.mjs --test tests/studio3d.browser.test.ts tests/studio3d-lifecycle.browser.test.ts tests/studio3d-compat.browser.test.ts
node --import ./tests/css-stub.mjs --test tests/studio3d-quality-lighting.browser.test.ts tests/studio3d-quality-panorama.browser.test.ts tests/studio3d-quality-alpha.browser.test.ts tests/studio3d-quality-glb.browser.test.ts
STUDIO_SHELL_URL=http://127.0.0.1:5173 node --import ./tests/css-stub.mjs --test tests/studio3d.shell.browser.test.ts
```

The browser tests need Playwright Chromium. `STUDIO_NATIVE=1` selects native Metal on macOS for local GPU review. `STUDIO_SUSE=1` enables the private six-icon fixtures when that brand pack is mounted. `STUDIO_SHOTS=<directory>` saves the fixture output for visual review.

The test set carries twelve public two-colour icons under `tests/fixtures/studio3d/icons` (written by `generate.ts` beside them, listed by `tests/helpers/studio3d-icons.ts`): three thin outlines, three heavy solids, three tall and three wide, so a twelve-subject collection can be rendered without the private SUSE icons. All twelve extrude at the full bevel at both the 0.025 and 0.05 requests.

The recipe and material pins under `tests/fixtures/studio3d/recipes/` record what the pushed 0.4.0 (commit `05faef7a4`) evaluates. `tests/studio3d-compat.browser.test.ts` renders that commit's renderer beside the current one in the same browser and compares exact pixels; it needs full git history and skips on a shallow clone. `STUDIO_COMPAT_SELF=1` compares the pushed renderer with itself. `STUDIO_WRITE_BASELINE=1` records the per-backend lighting measures, the flat backdrop colour and the tessellation baseline. The backdrop colour and the tessellation baseline are records only; a lighting entry is compared only once it is marked reviewed.

Preview and export share the same recipe. GPU pixels are tested for repeatability on a given backend; equality across every GPU is not promised. SVG admission and output limits are documented in the user guide.

The collection review owns one temporary renderer and serializes preview updates. Closing it or changing settings invalidates unfinished previews. PNG sets use the normal batch job and its progress, cancellation and delivery behavior. Animated lights use saved clip time, never the wall clock, when exporting.

3MF packages support core meshes, base and vertex colours, units, build transforms and Production Extension component references, including Bambu Studio multipart projects. Uploaded originals are kept verbatim (up to 128 MB). Studio generates a thumbnail; an embedded plate image is used when WebGL is unavailable or the mesh exceeds the preview budget (one million triangles or 256 MB of model XML). Slicer settings, painted filament assignments and texture properties are not reproduced.
