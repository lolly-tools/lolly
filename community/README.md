# lolly-tools

Community-safe tool definitions for [Lolly](https://github.com/lolly-tools/lolly) -
the constraint-first, template-driven creative-asset platform. Consumed by the
`lolly` monorepo as a git submodule at `community/`, and merged into the active
profile's `tools/` view alongside a brand pack (see the monorepo's `profiles.json`).

These tools are **brand-agnostic**: they declare no catalog asset dependencies,
so they run against any brand pack (SUSE, the blank `lolly-start` brand, or your
own). Each tool is a directory of *data, not code*:

```
<id>/
├── tool.json        # manifest (inputs, render config, examples)
├── template.html    # Handlebars markup (logic-less)
├── styles.css       # optional, auto-scoped
├── hooks.js         # optional imperative escape hatch
├── icon.svg         # gallery icon (Lucide house style)
└── card.svg|html    # optional authored gallery preview
```

## The tools

| Tool | What it does |
|---|---|
| `qr-code` | QR code generator - link, text, contact card, Wi-Fi, calendar event or location (SVG/PNG, custom colors, joined modules) |
| `gradient` | Mesh-style gradients from brand swatches - draggable colour points, grain, drift animation exportable as WebM / MP4 / GIF |
| `color-palette` | Grow a palette from one seed - harmony accents, OKLab/APCA ramps, an optional contrast grid and colour-vision preview, DTCG tokens plus CSV/CSS/SCSS/GIMP/ASE export |
| `contrast-check` | WCAG 2.1 and APCA pass/fail for a colour pair or the whole brand palette, with colour-blind and greyscale simulation |
| `compress-pdf` | On-device PDF compression |
| `strip-data` | Strip hidden metadata from images, on-device |
| `text-helper` | Text transforms and helpers |
| `countdown-timer` | Countdown timer graphics |
| `url-shot` | Rasterise a live URL (requires the `capture` capability) |
| `frame` | Screenshot beautifier - browser/phone/laptop frames, padding, shadow and a brand backdrop |
| `annotate` | Mark up your own screenshot on your device - arrows, boxes, numbered step pins, callouts, highlighter and a spotlight dim, with optional snap-to-text placement |
| `filter` | Photo effects in one tool - pick an effect (halftone, scanline, posterize, voronoi as vector; duotone, pixel-stretch, imperfections as raster) |
| `stationery` | Business cards, letterhead and compliments slips from the active brand - each piece at its real print trim (85 x 55 mm, A4, DL) |
| `print-sheet` | Imposition - one artwork n-up on A4/Letter/A3 with crop marks; paste a Lolly tool link to fill every cell |
| `certificate` | Completion and award certificates - brand lockup, rule border, true A4/Letter landscape page sizes, and a roster CSV to a sheet per person |
| `link-card` | Share cards for a link - title, description, site chip and a thumbnail, at Open Graph, square or summary size; paste a URL Capture link for a live screenshot thumb |
| `captions` | Subtitles for a clip - transcribe on device or drop in an SRT/VTT file, style the cues, export burned-in frames plus clean `.srt`/`.vtt` sidecars |
| `signature` | Signing pad - draw with a finger, stylus or mouse and get the signature on transparency as SVG or PNG, trimmed to the ink |
| `barcode` | Linear barcodes as vector art - EAN-13, EAN-8, UPC-A and Code 128, check digit worked out, printed digits in the guard-bar gutter |
| `icon` | Favicon and app-icon maker - a multi-size `.ico`, PNG and SVG, or the whole app kit as one zip: maskable and monochrome icons, a PWA `manifest.json` and a social card |
| `diagram-builder` | Org charts, flowcharts, timelines and more - from cards, text, Mermaid, DOT or CSV |
| `logo-wall` | Arrange a pile of logos into an even sponsor grid, optically balanced, each logo raster or traced to vector |
| `wayfinding-signage` | Directional event signage at real trim sizes - heading, arrow rows and an optional event logo |
| `work-avatar` | A round profile photo with a treatment and a ring of text along the arc - the LinkedIn campaign badge, in the active brand's colours and face |
| `calendar-ics` | A dated card or printable month grid that also exports a real `.ics` file |
| `agenda` | A conference programme from one table - time down the page and tracks across it, as a timetable, a printed list or a now-and-next screen, plus a real `.ics` of every session |

Tool `id`s are permanent contracts - never renamed or reused.

Split out of [`lolly-suse-tools`](https://github.com/lolly-tools/lolly-suse-tools)
(2026-07-08); SUSE-specific tools moved to the private `suse-lolly` brand pack.

## License

MPL-2.0 (see `LICENSE`). Tool icons follow the Lucide house style (ISC - see
`NOTICE.md`).
