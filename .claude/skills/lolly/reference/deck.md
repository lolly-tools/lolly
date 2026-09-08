# deck-studio

`deck-studio` (shown as "Markdown Slides") builds a branded slide deck. Its id is
`deck-studio`. Two ways to describe a deck:

1. **Markdown or JSON in `spec`.** When `spec` is filled it drives the whole deck
   and the block builder is ignored. This is the agent path: write the deck as
   Markdown, hand it over.
2. **The `deck` blocks input**, one block per slide with `layout`, `heading`,
   `subtitle`, `accent` and more. Use it when you are assembling slides field by
   field rather than from prose.

Formats: `pptx` (the default), `pdf`, `png`, `html`, `jpg`, `webp`. `pptx` and the
raster/PDF layouts need the Tier-B browser path (see `surfaces.md`); `html`
renders browser-free.

The Markdown dialect (`engine/src/deck-md.ts`, round-tripped by
`tests/deck-roundtrip.test.ts`):

- Slides are split by `---` on its own line, or by headings.
- `#` is the first slide's title, `##` the rest. A paragraph right after the
  heading is the subtitle.
- `-` items are bullets; two spaces of indent per outline level.
- `**bold**` and `*italic*` runs; GFM pipe tables; `![](url)` images on their own
  line; speaker notes as a trailing `<!-- notes: … -->` comment.

The JSON form of `spec` is a `slides` array of
`{ layout, title, subtitle, body, table, image, notes }`.

## A five-slide deck to PPTX, through the CLI

Write the deck to a file:

```markdown
# Q3 business review
FY26 planning

---

## Where we are
- Revenue up 18 percent quarter on quarter
- Two new markets live
- Net retention above target

---

## What shipped
- Mobile shell in public beta
- Offline export for every tool
- Brand import from design tokens

---

## Roadmap
| Quarter | Theme |
| --- | --- |
| Q4 | Brand switching for OSS clients |
| Q1 | Collaborative editing |

<!-- notes: keep this to two minutes -->

---

## Thank you
- questions@example.com
```

Render it:

```bash
lolly deck-studio --spec="$(cat deck.md)" --export=pptx --output=deck.pptx --no-provenance
```

`--spec` fills the `spec` input from the file; the five `---`-separated chunks
become five slides in the active brand. `--no-provenance` keeps the bytes
reproducible. `pptx` needs the browser tier, so run `lolly install-browser
--with-deps` and `npm run build:web` first, or render on a runner that has them (an
exit `3` means this install cannot).

For a `pdf` proof with no browser dependency, swap `--export=html` while drafting,
then produce the `pptx`/`pdf` where the Tier-B path is available.

## Top-level inputs

Generated from `community/deck-studio/tool.json`.

<!-- GEN:deck-inputs -->
| ID | Alias | Type | Default | Section | What it does |
|---|---|---|---|---|---|
| `size` | - | select | `wide` | - | Deck size |
| `pageNumbers` | - | boolean | true | - | Slide numbers |
| `brandLogo` | - | boolean | true | - | Brand logo |
| `footerText` | - | text | `""` | - | Footer text |
| `sourceAuthor` | - | text | `""` | - | Original author |
| `mode` | - | select | `deck` | - | Mode |
| `spec` | - | longtext | `""` | Advanced | Paste a deck - Markdown or JSON |
<!-- /GEN:deck-inputs -->

## The `deck` block fields

One block per slide. Generated from the `deck` block.

<!-- GEN:deck-block -->
| ID | Alias | Type | Default | What it does |
|---|---|---|---|---|
| `layout` | - | select | `content` | Layout |
| `heading` | - | text | `""` | Title |
| `subtitle` | - | text | `""` | Subtitle |
| `body` | - | text | `""` | Body |
| `visual` | - | asset | - | Visual - a Lolly tool link or image |
| `data` | - | text | `""` | Table data |
| `accent` | - | color | `""` | Accent |
| `logo` | - | select | `auto` | Logo on this slide |
| `notes` | - | text | `""` | Speaker notes |
<!-- /GEN:deck-block -->
