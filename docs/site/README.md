# docs/site - the landing page as data

The `/info` front door (plans/177) is built by `docs/build.ts`, but its COPY
lives here so it can be edited like any other docs page. One file per beat,
top to bottom:

| File | Beat | Notes |
|---|---|---|
| `hero-chrome.json` | 1 - hero | `lead` + the cycling `cycle[]` words (each `slug` is the receipt page) and the two `ctas[]`. The first word is the one a reduced-motion reader, a screenshot and a share preview see, so it carries the page's main claim ("is sovereign", which links the content sovereignty page, with "is yours" second). The tagline and one-liner under them are `docs/site.md`. |
| `format-last.json` | formats page | The copy for the formats page's proof (the landing no longer has a band of its own): `heading`, `line`, then `outputs[]`, one Lolly Demo piece as five real files. Each output's `id` picks its panel in `FORMAT_LAST_PANELS` (docs/build.ts); the panels and originals are `docs/figures/formats-last-*`, made, read back and signed by `node scripts/build-format-last-art.ts`. `docs/formats.md` opens with the same `heading` and `line` and shows the panels with `drawn`, `caption` and the files to download. |
| `covers.json` | 2 - covers | No heading row above the fan by design; `caption` is one muted line under the dots that says what the fan shows. `covers[]`: `img` is a path under `/info/shots/` (a posed 4:3 still in `docs/shots/covers/`), `href` an app route, `name`/`promise`/`alt` copy, `hue` the OKLCH hue the cover was posed in. Add `video` (a WebM or MP4 under `/info/shots/`, e.g. `covers/3d.webm`) to make a cover a ~6 s loop with `img` as its poster - Audiogram and 3D ship that way. The covers are POSED, not hand-made: `node scripts/build-covers.ts` (against a running `dev:web` on the lolly-demo profile, the one lolly.tools ships) captures each one as the app wearing a derived design system a hue apart (16 covers, 22.5° steps), so the fan reads as a rainbow, and the fan opens on the cover nearest the reader's own accent (`lib/covers-flow.ts`). Some covers are the tool's OWN export rather than a photograph of the app (Lolly Filter is its SVG export, so `img` may be an `.svg`; Audiogram is a 60 fps MP4 export) - the script's `exportStill`/`exportVideo` pose kinds; Utilities is a VECTOR screenshot of the app view through the DOM-to-SVG walker (`walkerSvg`). Keep `hue` and the order in step with the script's `POSES`. |
| `whatwhy.json` | 3 - what / why | The two columns; `what.library` is the one line about Assets under the What body. `stats[].count` points at a LIVE counter (`tools`, `formatsOut`, `formatsIn`, `languages`) so no number is ever typed here. `why.statement` is the page's ONE offline claim (tests/docs-claims.test.ts pins it; the long form lives on trust.md). |
| `persona.json` | 4 - who is it for | `doors[]` → `lanes[]`. The six doors are PEOPLE (plan 341): "Just you"; "A small team or club"; "Clients and partners"; "Classes, events and the public"; "Developers and agents"; "An organisation". The six documentation pathways keep their one home in the strip above the What column, and every lane's `doc` opens a page in one of them. A door's `id` is the stylesheet's pairing key, so a new door needs its rules in `docs-landing.css`. A lane's `cta.href` is `/` (the app) or an app route (`#/tool/design`); `doc` is the docs page. `links[]` are optional and each carries a docs `slug` or an `href`: an app route (`#/tool/redact`) or a page of the Lolly repository on GitHub (the render action); `note` is code, not copy. `mascot` points at a credentialed `.webp` in `shells/web/public/info/mascots/` - on a door it rides the top tab, on a lane it sits figure-sized beside the pane's copy. |
| `work.json` | 4b - Lolly Work | The organisation band: `eyebrow` (the product's name, rendered above the heading), `heading`, `body`, and two external `links[]` (the hosted demo at lolly.work, the lolly-work repository). Product-level copy only. Lolly Work is the software; lolly.work is only the domain of the hosted demo. |
| `behind.json` | 5 - who is behind this | `sceptic` is FINAL copy pinned byte-identical in three homes (here, faq.md, trust.md). |

The other files here - `downloads.json`, `import.json`, `formats.json`,
`formats-catalog.json` - are bands hosted by the install, design-import and
formats pages, read by the same build.

`downloads.json` is the "Get the app" rail, placed after the Lolly Work band:
`rows[]` (apps, Linux, and terminal and automation), each a short `label` over
its `items[]`. A tile with `file` links to that `lolly-latest.*` alias on
lolli.li; a tile without one links to `slug` + `hash`, a section of a docs page
(the install page for the apps; the CLI, TUI, MCP, extension, Action and SDK
pages for the third row). On a phone the rail folds to its heading and one
"Show every download" switch (a checkbox, so it works with scripts stripped). `logo` is a mark from `docs/logos.ts`, and `icon` (a DOC_ICONS key)
stands in where a mark cannot be shown. The link fields are always read from
this English file by tile `id`. `tests/docs-downloads.test.ts` checks the rows,
the marks and that every anchor is a real heading.

## How each file localises

Two mechanisms, and the difference matters:

- **The beat files are English-only.** Every copy string in them is looked
  up through the site catalogue (`docs/i18n/<lang>/site.json`) by
  `localizeSiteJson` in build.ts, keyed by the English text - the same
  English-as-key contract the nav and sidebar use. `scripts/translate.ts`'s
  `site` corpus walks these files, so a changed string becomes a pending key on
  the next wave and ships English until then (the identity fallback). Keys
  named in `LANDING_I18N_SKIP` (`href`, `slug`, `class`, `img`, `video`,
  `mascot`, `id`, `count`, `note`) are never copy and never translated.
- **`import.json` and `formats.json` keep locale twins** at
  `docs/i18n/<lang>/site/<name>` (the older mechanism); `downloads.json` and
  `formats-catalog.json` have none.

Register rules for the door (the dictionary and overclaim bans, say-offline-
once, one esoteric term) are enforced by `tests/docs-claims.test.ts` over these
files, and the vernacular gate (`scripts/check-docs-vernacular.ts`) scans them
with the rest of the English sources.
