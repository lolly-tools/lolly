# Timezone

A community tool, available to every content profile, and a brand-informed successor to Meeting Planner. Fonts and colours resolve from the active profile; no brand assets are bundled in the tool. The original tool and its URLs stay available. Timezone is a new tool with an explicit, portable location model.

- Live now by default, or a scheduled wall time interpreted in an IANA reference timezone. Repeated autumn hours have an earlier/later choice; skipped spring hours are rejected.
- Any number of ordered location rows: a label, city or IANA identifier, annotation, colour, optional timezone-region fill, and optional exact coordinates. Reorder the rows to set the tour route. City names resolve offline; add a country/province or timezone override for ambiguous names. Unknown locations stay visible as errors instead of silently becoming UTC. An explicit IANA identifier uses its representative city unless coordinates are supplied.
- Shared longitude, latitude, roll and zoom across vector and WebGL. Drag to rotate, Shift-drag to roll, scroll to zoom, or use the keyboard. Click a location card to centre it. The view input persists in URLs and slots.
- Globe, Equal Earth, Natural Earth, equirectangular and Mercator. WebGL can blend the globe into a selected projection, with camera FOV and tilt still available. The vector renderer emits the selected final projection; intermediate unwrapping and oblique camera tilt are WebGL treatments.
- Midnight, Paper, Brand Colour and Quiet Atlas treatments resolve active primary/secondary/spectrum colours and body/display/monospace fonts. Typography always follows the loaded brand; there are no per-tool font overrides. Dark brand colours get a lighter treatment for legible indicators on dark artwork.
- SVG/PDF/PNG/WebP/JPEG artwork; MP4/WebM/GIF animation; JSON/CSV/Markdown and a single UTC calendar event with all local times in its description. JSON includes resolved coordinates, IANA identifier, ISO local datetime with numeric offset, day difference and annotations. Text data comes from hooks and works without a browser. Live exports refresh their instant immediately before serialisation.

The vector atlas uses Natural Earth 1:110m geometry to keep printed artwork and gallery previews light; WebGL uses the more detailed 1:50m geography. Vector is actual SVG paths, with no map raster. WebGL artwork keeps the type vector in SVG/PDF and embeds its rendered map as an image. Choose Vector for wholly vector files. Video captures the complete artwork, including labels and active tour cards. Match export duration to the motion duration for one loop. Playback respects reduced motion until explicitly started. A missing WebGL context falls back to vector.

The default opens with no story or locations. Empty text and location sections take no canvas space. Five starting templates are available in the tool, including a clean map animation. Export dimensions own the artboard; layout reflows to that aspect ratio, including portrait and landscape, without changing the selected output size. The map uses the full available width, cropping vertically if needed; Fit whole map keeps the entire globe or projection visible. Map only hides story and schedule sections without deleting locations or changing structured exports, so those locations can still drive regions and camera tours. With no surrounding details, the map occupies the entire canvas.

## Rendering decision and research

The [Vertex Earth interactive example](https://github.com/bobbyroe/vertex-earth/tree/interactive) uses Three.js, orbit controls, an icosahedral point field and texture-driven shaders. It is an excellent visual reference, but its point treatment alone does not provide projected maps, timezone boundaries or structured scheduling. No code or imagery from that project is incorporated.

[MapLibre's globe](https://github.com/maplibre/maplibre-gl-js/blob/main/developer-guides/globe.md) and [projection specification](https://maplibre.org/maplibre-style-spec/projection/) are a strong choice for a navigable tiled basemap. Its built-in globe/Mercator transition is designed around map navigation. For this tool, styling the same geometry as SVG and morphing into several artwork projections favours a shared geographic model.

The chosen stack is [D3 Geo](https://d3js.org/d3-geo) for projection, clipping and SVG paths, plus pinned Three.js 0.185.1 [BufferGeometry](https://threejs.org/docs/pages/BufferGeometry.html) and [ShaderMaterial](https://threejs.org/docs/pages/ShaderMaterial.html) for a WebGL 2 globe. A 256 × 128 geographic mesh blends sphere positions into the selected projection. Geographic directions, rather than UV coordinates, interpolate through the shader, avoiding the longitude texture seam. A 4096 × 2048 atlas (clamped to the device texture limit) is painted from Natural Earth 1:50m country geometry, timezone polygons, graticules and routes. The GPU surface presents immediately into a visible 2D canvas so export never reads an already-cleared GPU buffer.

The same great-circle tour and easing drive vector and GPU views. `canvas.__lollyFrameRender(t)` is deterministic, and the live loop yields to the export clock. Frame-by-frame capture preserves changing HTML/SVG labels. No stream-only map capture crops off the artwork. Geometry, materials, textures, listeners and animation frames are disposed when the tool leaves the document.

[Timezone Boundary Builder 2026c](https://github.com/evansiroky/timezone-boundary-builder/releases/tag/2026c) supplies 419 named land regions, simplified to 0.025 degrees for artwork. These are real civil-time regions, not 15-degree longitude stripes. Small offshore islands and fine boundaries are simplified; historical boundary changes and ocean zones are not represented. Offsets are calculated with the host's `Intl`/ICU timezone database for the selected instant, independently of the boundary polygons. A newer timezone identifier unsupported by the host is reported explicitly. The day/night terminator is an approximate solar-declination illustration.

## Authoring and validation

`src/*.ts` are authoring sources; `hooks.js` and `lib/renderer.min.js` are generated, self-contained tool data. There are no engine imports, runtime CDN dependencies, map keys or network lookups. Labels and coordinates stay on the device.

From the parent Lolly checkout:

```sh
npm run build:timezone
npm run typecheck:timezone
node scripts/build-timezone.ts --check
node --test tests/timezone-tool.test.ts tests/timezone.browser.test.ts
npm run build:catalog:all
npm run validate:catalog:all
```

To regenerate the bundled data from pinned upstream sources, run `node scripts/vendor-timezone-data.ts`, then rebuild. The data and library licences are in [THIRD_PARTY.md](THIRD_PARTY.md) and `licenses/`.
