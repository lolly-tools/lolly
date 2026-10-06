# Recreate a deck on brand

Use this playbook when the task is to rebuild someone else's deck in the design
system: the same content, set on brand, delivered as a `.lolly` a person opens in
the app and as a `.pptx`, often in a light and a dark theme. One Design document
serves every theme: its colours, logos, icons and photo looks follow the theme it
is shown or exported in. When the deck should
be renovated in place instead (its own slides, recoloured, refonted, its furniture
swapped), use `lolly_rebrand` and `reference/rebrand.md`.

Every step below is one verb on the CLI and one tool on the MCP server, with JSON
in and JSON out. Work from what those verbs return. Unzipping the deck yourself,
reading brand rules from files by hand or generating hundreds of layers from a
throwaway script are the habits this loop replaces, and a grader counts any script
left in the delivery folder.

In a checkout with no `lolly` on your PATH, run each verb from the repository root
as `node shells/cli/bin/lolly.ts <verb> ...` (Node runs the TypeScript directly).

Two steps need the web shell: exporting a `.pptx` (`lolly run <file.lolly>
--export=pptx`) and the `render` family of `lolly check` (clipped text, contrast
and fonts on the painted page). In a checkout, either build it once with `pnpm run
build:web`, or start it with `pnpm run dev:web` and set `LOLLY_WEB_BASE` to the
address it prints. Without pnpm, start it from `shells/web` with the repository's
own Vite: `LOLLY_PROFILE=<profile> node ../../node_modules/vite/bin/vite.js`, and
set `LOLLY_WEB_BASE` to the address it prints. Run the web shell and every `lolly` command under the same
`LOLLY_PROFILE`, because the profile decides the slide master and the catalog both
sides use. Without the web shell, `lolly check` says the render family is
`unavailable` and runs the rest.

## The loop

1. **Read the source.** `lolly read <deck.pptx> --json --media=<dir>` (MCP
   `lolly_read` with `file`, and `media: "inline"` for the picture bytes). Each
   slide comes back with its text in reading order, each with a `role` (`title`,
   `body`, `label`, `caption`, ...) and its runs; the speaker notes as paragraphs of
   lines, with every `a:br` kept as its own line; the pictures by `sha256`, with
   their placement, pixel size and crop; tables, charts and the class of every
   object. Content classes are what you carry over; decoration and page furniture
   are what the design system replaces. Save the JSON: `lolly check` takes it as
   `--source` later. With `--json` the inventory sits in an envelope: `ok`, then
   `result` with `source` (the deck's name, sha256, size and slide count),
   `slides`, `media` and `warnings`. Each of `result.slides[]` has `number`,
   `layoutName`, `text[]` (each with `objectId`, the id a compose `from` names,
   plus `role`, `class`, `box`, `readingIndex`, `plain` and `paragraphs` of
   runs), `notes` (`text`, in the form an artboard's notes take, and `paragraphs`
   of `lines`), `pictures[]` (`objectId`,
   `sha256`, `ref`, `kind`, `box`, `crop`, `width`, `height`), `tables`, `charts`
   and `objects`.
2. **Brief yourself.** `lolly system context --json` (MCP: the
   `lolly://design-context` resource), with `--file=<tokens.json>` when the task
   comes with a design system file. Read the approved colour pairings, `type.styles`
   (the sizes a `$style` writes), logos per surface, the slide master's archetypes
   and `houseRules`, the `themes` with their semantic and role colours, and the
   photo looks under `media.treatments`. A house rule is a machine-checked record: its `kind` and
   `parameters` say what `lolly check` will flag. Compose with token values and
   catalog ids from the brief, never invented ones.
3. **Plan each slide before you draw.** For every source slide, write down which
   strings it carries, which archetype of the brief's master fits (`title`,
   `content`, `columns-3`, `full-image`, `table`, `closing-thanks`, ...; `lolly
   compose --list --file=<tokens.json>` lists them with their slots and dark
   twins), and which of the traps listed below the slide sets. Decide every
   deliberate change now and put it in `edits.json` (below), with its reason.
4. **Compose the slides from the master, once, for every theme.** `lolly compose
   --suggest --source=<deck.pptx> --file=<tokens.json> --output=spec.json` writes
   a first spec: an archetype per slide with the reason it was picked, slots
   filled by `from` references to the source text, the deck's pictures as
   `photo:<12 hex>` keys, and each slide's `source` and notes. Edit it to your plan
   from step 3, set `"themes": ["light", "dark"]` at its top, then `lolly compose
   spec.json --source=<deck.pptx> --file=<tokens.json> --output=<name>.json
   --edits-out=compose-edits.json` (MCP `lolly_compose`). Each slide comes out
   with the master's furniture and its bindings, so `lolly check` judges it by
   the master's house rules and the `.pptx` has real slide layouts with
   placeholders. With two themes the composed document follows the theme on its
   own: logo furniture is written as `<id>?theme=auto`, every ground, bar and ink
   the master takes from a token is stored with a link to that token, an ink the
   master takes from a brand constant on a ground that follows the theme is linked
   to the theme's own ink of that colour, accent emphasis is linked to
   `color.role.accent-ink`, and token references in slots and in `under` and
   `over` rows become links too. You do not need an `fg` on every slot. What the
   master states as a hex stays literal, so write `{color.role.*}` references for
   the other inks and tints you add (step 5). A slide that is dark by design (a
   title over a photograph) stays as it is in both themes, in the `.pptx` layouts
   too. Put deck-wide choices at the top of the spec
   rather than on every slide: `furniture` (the deck's `omit` list and footer),
   `pageNumbers`, `emphasis` and `case`. `lolly compose --help` lists the spec's
   keys, and `reference/design.md` explains them, the slot values and what compose
   reports. A deck that needs a different layout per theme can still be composed
   once per theme with `--theme=light` and `--theme=dark`: `--theme=dark` takes
   each archetype's dark twin, and a light archetype with no twin is drawn under
   the design system's Dark theme and binds the light layout in the `.pptx`, which
   the export notes name.
5. **Author what no archetype holds.** Rows a slide needs beyond its archetype go
   in that slide's `under` (painted first: a full-bleed photo) or `over` (painted
   last: a line with no slot). A slide no archetype fits can be written by hand
   in the same document: a `frame` artboard with `order` set to its slide number
   minus one and the speaker notes in its `notes`, each layer placed with `$in`,
   text set by `$style` (the brief's roles, or your own `$styles`), and repeated
   rows laid out with `$stack`, `$grid` and `$table` (see `reference/design.md`).
   Without compose, the whole deck can be written this way, with
   `"$themes": ["light", "dark"]` beside `boxes` so the text styles' colours
   follow the theme, at the cost of an export of loose shapes. Use a source
   picture by its ref, `user/media/<sha256>`, and a new picture by a placeholder
   key such as `photo:cover`. For one document in every theme:
   - write each colour that changes with the theme as a token reference
     (`"bg": "{color.role.card}"`, `"fg": "{color.role.muted-ink}"`, and
     `{@color.role.accent-ink w500|word}` for a coloured run); the brief lists
     the role tokens per theme;
   - write each logo and icon as `<id>?theme=auto`;
   - give each photograph the brand's look on its id
     (`photo:cover?treatment=<look id>`, from `media.treatments` in the brief);
     a look with a dark variant grades the photo darker in the dark theme;
   - draw a scrim as a box with a linear `grad` and `"$tint":
     "{color.semantic.surface}"`, so it takes each theme's ground. A `grad` is
     a Lolly gradient spec such as `lin_180_ffffff00-0_ffffffcc-100`, not CSS
     (the grammar is in `design.md`, under the colours that follow the theme);
   - keep a mirrored photograph as `flipH: true` on the layer, never as a
     pre-flipped picture.
   An artboard's `notes` take a blank line between paragraphs and a single
   newline for a line break inside one, which the `.pptx` keeps as `a:br`. An
   empty line inside a paragraph is a line holding one no-break space (U+00A0),
   which the `.pptx` writes as two `a:br` in a row. The inventory's `notes.text`
   is already in this form, so it can be copied as it is; `notes.paragraphs` is
   the exact form.
6. **Measure before you settle a text box.** `lolly measure --text=<text>
   --width=<px> --style=<id> --file=<tokens.json>` (MCP `lolly_measure_text`) says
   where the lines break and how tall the box is, in the faces the canvas loads. A
   line marked `nearEdge` is a few px from breaking: widen the box. To measure a
   whole document, `lolly measure <doc.json> --text-layers`. Compose measures
   every slot it fills and reports the ones that clip; `--fit=shrink` steps them
   down to the master's smallest size for the role.
7. **Package once.** `lolly package <name>.json --source=<deck.pptx>
   --asset=photo:cover=<cover.jpg> --label="<Deck>" --file=<tokens.json>
   --output=<name>.lolly` (MCP `lolly_package` with `document`, `source`,
   `assets` and `label`). `--source` resolves every `user/media/<sha256>` ref and
   every `photo:<12 hex>` key compose wrote from the deck, also with a
   `?treatment=` look on it, `--asset` gives each other placeholder its bytes, and
   the label is the name the app shows. The pictures travel as they are; their
   looks are applied when the document draws them. The file stores the colour of
   each token reference in the default theme (or `--theme`), plus its link, and
   stores no theme
   choice, so it opens in the default theme and the person switches theme in the
   Design inspector's Document section. The file carries no design system: with
   `--file`, the report adds a `design-system.not-carried` note and its next
   commands keep the `--file`. The app opens a `.lolly` in its own active design
   system, where every linked colour takes that system's value, so pass the same
   `--file` to each `lolly check` and `lolly run` of the file and name the system
   at hand-over.
8. **Check the `.lolly` in every theme.** `lolly check <name>.lolly
   --themes=light,dark --source=<inventory.json> --edits=edits.json
   --file=<tokens.json>` (MCP `lolly_check` with `file`, `inventory`, `edits` and
   `themes`). One findings list covers structure, the painted page with its
   photographs, brand and house rules, Verify layout clues and fidelity: every
   source string missing or edited, every speaker note not carried, and any change
   in slide count or order. The page is painted once per theme, so the render,
   brand and Verify families run in each theme and their findings carry the
   `theme` they were found in (white text that reads on the dark photo grade can
   fail on the light one); structure and fidelity run once. A link that does not
   resolve in a theme is a
   `brand.token-link.unresolved` warning. Fix each finding at its `layerId` in the
   document, package again and check again. Exit `0` is clean; `5` means findings
   to review.
9. **Export every theme, then check each `.pptx`.** `lolly run <name>.lolly
   --themes=light,dark --export=pptx --output=<name>.pptx --file=<tokens.json>`
   (drop `--file` when the profile's own system styled the deck) opens the file once in
   the web shell and writes `<name>-light.pptx` and `<name>-dark.pptx` with the
   app's own exporter. Then `lolly check <name>-light.pptx
   --source=<inventory.json> --edits=edits.json`, and the same for dark: on a
   `.pptx` the text rules of Verify and fidelity run, with the notes. The theme
   names are the ones the content profile's design system declares (`--themes=all`
   takes every one), and a theme switch resolves each link in that design system,
   so with `--file` write references to token paths both systems have.

## The traps a literal copy falls into

A deck carries habits the design system does not want. Each has a stable code in
`lolly check`, so you can see each one rather than guess.

| In the source | Code a literal copy raises | Do instead |
|---|---|---|
| A small all-caps line over the heading (an eyebrow) | `verify.eyebrow-heading` | Fold it into the heading or the body, and declare the change. In compose, `{ "from": "<id>", "join": ": " }` runs both lines into one heading, and `{ "from": ["<eyebrow id>", "<heading id>"], "join": ": " }` does it when the eyebrow is its own object; `--suggest` writes both. |
| Rounded cards with a coloured strip along one edge | `verify.fingernail-card`, `brand.rule.stroke-on-rounded` | Drop the strip or the rounding. |
| `01`, `02`, `03` on items that are not steps | `verify.decorative-numbering` | Drop the numbers and declare each one as an edit. `--suggest` keeps such cards a row of columns without their numbers, and compose's `--edits-out` declares each dropped number as decorative numbering. |
| Running text packed with "X, Y and Z" lists (four or more, denser than ordinary writing) | `verify.list-triads` | Keep the author's wording; the finding is reported for review. Three items laid out as three boxes or lines raise nothing. |
| Centred text where the house rule sets it left | `brand.rule.text-align` | Left-align it, or use an archetype that places the line. |
| Headlines in another weight or in capitals | `brand.rule.text-weight`, `brand.rule.text-case` | Set text by `$style`, which writes the brand's weights. In compose, a bold word copied into a heading the weight rule keeps from bold takes the brand's accent colour instead (`emphasis`, on by default there), and `case: "sentence"` sets Title Case headings in sentence case on request. |
| Text over a photograph | `design.text.contrast-low` when the rendered pixels under the text's lines fail the minimum over nearly all of that area (the evidence `reason` is `sampled-background` and `ratio` is the median); `design.text.contrast-review`, a visual check, when the picture there is partly light and partly dark. Both are read from the painted page with the photograph in it, uploads and looks included, in each theme checked | Keep a scrim or the dark part of the picture behind light text, and check every theme (`--themes=light,dark`): a dark grade under ink set for the light deck fails only in the dark one. A visual-check note is not a pass: look at those layers in the export. |
| A logo over a photograph | `brand.rule.logo-surface` when the mark is the one for a plain ground | In compose, keep `logo: "auto"`: over an `under` picture covering 90% of the slide it takes the on-photo mark. Give compose the picture's bytes (`--source`, or `--asset=KEY=PATH`) and it leaves the logo off, with a `compose.logo.photo-contrast` note, where no mark the brand allows there reaches 3:1 against the picture. |
| A photo cropped to fill its box | none: only a reviewer sees a stretched picture | Place it with `fit: "cover"` in a box of the slide's shape. |
| Speaker notes broken into lines | `fidelity.notes.missing` when a note is lost | Carry every line, with its line break, in the artboard's `notes`. |
| Text you dropped or reworded | `fidelity.text.missing`, `fidelity.text.edited` | Declare the change in `edits.json`, or carry the string. |
| Slides out of order | `fidelity.slides.count`, `fidelity.slides.order` | One artboard per source slide, `order` in slide order. |
| Text longer than its box | `design.text.overflow` | Measure first (step 6) and size the box to the text. |
| A small photo stretched across the slide | `design.image.low-resolution` (a picture drawn at more than twice its pixel size; an SVG is never judged) | Use a picture at least half as wide as it is drawn (960 px for a full-bleed 1920 px slide), or draw it smaller. |
| A scrim in a brand colour made translucent (`#13294bcc`) | none: a palette colour with an alpha channel is that palette colour | Keep it. Any other translucent colour comes back as `brand.color.unknown`, since its look depends on what is under it. |
| A colour written as a hex in a deck for two themes | none: a hex is the same colour in every theme, so a light card stays light in the dark export | Write it as a token reference (`{color.role.card}`, `{color.semantic.text}`), and check with `--themes`. |
| A photograph already graded, flipped or darkened outside Lolly | none: a reviewer sees the light grade in the dark export | Use the source photograph with the brand's look on its id (`?treatment=<look id>`), `flipH` on the layer and a `$tint` scrim, so each theme grades it. |

Verify findings and house rules still in review state `draft` come back as
warnings: they are for you and the person you hand over to, and a reviewer reads
them. A required house rule the brand has approved comes back as an error.

## edits.json

Every wording change made on purpose is declared, with a reason, as a JSON array:

```json
[
  { "source": "WHY TIDES MATTER", "reason": "the eyebrow is folded into the heading" },
  { "source": "01", "reason": "decorative numbering on items that are not steps" },
  { "source": "Thank you", "result": "Thank you.", "reason": "house punctuation" }
]
```

`result` is what the rebuild says instead; leave it out when the string is dropped.
A speaker note you changed on purpose is declared the same way: put the whole
note, as `lolly read` prints it, in `source`, or one entry for each paragraph of it
you cut or reworded, and the note no longer counts as missing.
`lolly check --edits=edits.json` keeps each declared change in the report as
`info`, marked excepted, and lists it under `fidelity.excepted`. A declared edit is
never hidden, and a change you did not declare stays a finding. Text the
comparison does not count as content (an icon-font glyph name such as `east`, a
page number, a footer) needs no entry; one declared anyway is never reported as
unmatched.

`lolly check` and the grader also read the array under an `edits` key, `{
"edits": [...] }`, which is what `lolly compose --edits-out` writes. Compose lists
every source string its slides leave out, each with the same generic reason ("Left
out of the composed slides."). Start from that list, add the changes you made by
hand, and write the reason for each before you deliver `edits.json`.

## Hand over

Deliver one folder holding `<name>.lolly`, the one document for every theme,
`<name>-<theme>.pptx` for every theme asked for, `edits.json`, and a
`delivery.json` that names the themes the document is for:

```json
{ "files": { "<name>.lolly": ["light", "dark"] } }
```

Step 9's `--themes=light,dark --output=<name>.pptx` writes those `.pptx` names.
To write or replace one theme's file under its exact name, give `--theme` and the
whole name: `lolly run <name>.lolly --theme=dark --export=pptx
--output=<name>-dark.pptx` (add `--file=<tokens.json>` when the deck was built
against one). `--themes=dark` there would add the theme again and write
`<name>-dark-dark.pptx`.

(A deck composed once per theme is delivered as `<name>-<theme>.lolly` for each
theme instead, and needs no `delivery.json` when each file name carries its
theme.) Before you hand it over, every one of these holds:

- `lolly check` reports no error on any of the files, the `.lolly` checked with
  `--themes` in every theme;
- no source string and no speaker note is missing, other than those declared in
  `edits.json`;
- every file has the source's slide count, in the source's order;
- every theme is there as `.lolly` (one document listed with its themes, or one
  file per theme) and as `.pptx`;
- every `.lolly` reopens in the app with its label (`lolly run <file.lolly>
  --export=pptx` opening it is one proof);
- `edits.json` is a well-formed list of edits with a reason of your own on every
  entry;
- when a `--file` design system styled the deck, the hand-over names that file and
  says the `.lolly` shows its colours as authored only where that system is
  active: in the app, the person adds the tokens file as a design system and
  switches to that system before opening the `.lolly`. Opened in any other
  system, every linked colour takes that system's value.

Say which checks you could not run and why, and list the Verify and house-rule
findings you left in place with your reason for each.

## Grading a run

`skills/lolly/evals/recreate.json` is the brief an evaluator hands an agent. Its
synthetic case rebuilds `tests/fixtures/rebrand/recreate.pptx` against
`tests/fixtures/recreate/tokens.json` under `LOLLY_PROFILE=lolly-start`. In a
checkout, `tests/fixtures/recreate/acceptance.compose.json` is a complete
declarative example for that source and brief, including its live photo look,
scrim and theme-linked ground. `pnpm run eval:recreate -- <folder>` (or `node scripts/recreate-eval.ts
<folder> --json`) grades the delivered folder against the case's gates, which are
the hand-over list above. Add `--acceptance --browser=require` for final delivery:
this also requires zero Verify and house-rule findings, no clipped text, every document theme
painted and reopened, unchanged note paragraphs and line breaks, matching theme
grounds, accounted edits, no scaffolding, and one `.lolly` serving every theme.
A skipped render or reopen fails acceptance. Without `--acceptance`, those quality
measures are reported beside the base gates. A case can also name the acceptance
gates in its `pass` object. Review the rendered slides in both themes as well;
measured acceptance does not establish visual quality.
It exits `0` when every gate passes and `1` when one does not. It exits `2` when
it cannot use what it was given (a source deck that does not read as a deck, a
design system file with no colour tokens, an `--out` folder that does not exist,
or a case whose `pass` asks for a threshold the scorer does not hold), and `3`
when the scorer itself could not finish, so a `1` always means the delivery
failed a gate. A case gates on the gates its `pass` names, at the one threshold
each supports; its `report` names fields of the score's `reported`.

It also reports, without gating:

- each `.pptx` file's tier (`pptx.tier`): `A` when its slides use more than one
  slide layout or carry placeholders, which a composed deck's export does, and `B`
  when every slide is free text boxes on one blank layout. `pptx.layouts` counts
  the layouts the slides use and `pptx.placeholders` lists the placeholders on
  each slide;
- the notes whose line breaks came back as separate paragraphs in a `.pptx`
  (`notesLinesSplit`). The export writes a single newline in a note as `a:br`
  inside its paragraph, so a note carried from `lolly read` scores 0 here;
- the frames whose ground differs from the theme. A frame is left out of that
  count, and listed as exempt, when its master archetype has no form for the
  theme (a title or closing slide that is dark by design, a light statement slide
  with no dark twin) or when a picture covers 90% or more of it;
- the delivered files whose theme it could not read (`unthemed`): a file name with
  no theme word in it and no entry in `delivery.json`.

A `.lolly` listed with several themes in `delivery.json` is checked once per
theme, with its linked colours, logos and looks resolved in that theme.

## What is not built yet

- A design system carried in a packaged file. `lolly package --file` caches each
  linked colour in the `--file` system and stores the link, but the `.lolly` holds
  no design system, and the app's `#/open` route and its Open shared design choice
  render the file in the app's active system. Until a file can carry its system,
  the hand-over says which system to add (see Hand over).
- A theme stored in a packaged file. `lolly package` stores no theme choice, so
  the `.lolly` opens in the design system's default theme; a session saved from
  the app keeps the theme it was saved in.
- Logos a brief lists that the catalog does not hold. A `--file` design system
  from another brand can list logo ids that the content profile's catalog lacks:
  `lolly assets <query>` finds none, compose leaves the logo off with a note, and
  `lolly package` refuses the id. Package the mark as a placeholder picture with
  `--asset` if you were given its file; otherwise deliver without the logo and state that at hand-over.
