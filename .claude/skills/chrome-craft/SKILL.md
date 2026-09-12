---
name: chrome-craft
description: >-
  Review or deslop the web shell's chrome against Lolly's own design language.
  Use for the tool input sidebar (views/tool-inputs.ts, parts/tool.css,
  parts/fields.css, parts/color-field.css, parts/tool-chrome.css) and the
  /profile settings view (views/profile/, parts/profile.css). Args: `review
  [target]` judges and reports with severities; `deslop [target]` makes
  surgical, behaviour-preserving fixes inside the diff or the named surface.
  Never for tool templates, the canvas, the export stages or the /info site.
---

# Chrome craft

Lolly's chrome has a written look: tokens, surface levels, one field primitive,
cascade layers and a set of standing rules from the maintainer. This skill
borrows a review procedure (lenses, severities, a filter for taste, a
diff-scoped cleanup) and points it at that look. It carries no look of its
own. When a checklist item here and a file named under "The house look"
disagree, the file wins.

## Scope

Two surfaces, both chrome, in this order:

1. **The tool input sidebar.** The first thing a new visitor operates. One
   generic renderer, `shells/web/src/views/tool-inputs.ts`, draws every
   declared input for every tool from the engine's input model. Sheets:
   `styles/parts/tool.css` (sidebar, rows, sections, blocks),
   `parts/fields.css` (the form primitive), `parts/color-field.css` and
   `parts/tool-chrome.css` (export popup, toasts, the mobile sheet).
2. **The /profile settings view.** Where a returning user lives.
   `views/profile.ts` plus `views/profile/*.ts` (context object `pv`), sheet
   `parts/profile.css`. Direction from Andy, 2026-09-12: profile becomes the
   one comprehensive settings page. Read-only glances that sit on the
   dashboard (`views/dashboard.ts`) move into profile sections over time so
   global settings have a single point of entry.

Out of scope, always: anything inside `.tool-canvas`, `#tool-content`,
`#tool-canvas`, the export stages (`.pro-export-canvas`, `.me-canvas`), tool
templates under `community/` or `brands/`, and the /info docs site. A render
is the user's output and its geometry is shared with the CLI.

## The house look (read these, do not restate them)

- `shells/web/src/styles/tokens.css`. HSL triples in the shadcn convention so
  `hsl(var(--x) / .5)` works. Three themes on `[data-theme]`; `brand` is the
  pre-JS default. Two generated blocks: the chrome scale from
  `shells/web/design/chrome-tokens.json` and the semantic roles from
  `shells/web/design/ui-semantics.json`, both emitted by
  `pnpm run gen:chrome-tokens`. New chrome consumes the `--ui-*` roles.
  `--fs-*` carry the large-text multiplier inside the token. The file is
  unlayered on purpose.
- `styles/parts/surfaces.css`. The signature: a hairline ring plus a soft
  drop, five levels, a glass variant. Do not add a sixth level.
- `styles/parts/fields.css`. The one form-control primitive. Adopting a
  `.field-*` class is two-sided: delete the view sheet's duplicate paint or
  the class is a lie.
- `styles/parts/buttons.css`. `.btn`, `.btn--primary`, `.btn--glass` (the
  frosted pill, Andy's chosen treatment).
- `styles/app.css`. Layer order `vendor, base, primitives, chrome, views,
  overrides, a11y`. Priority comes from the layer, not from load order.
- `shells/web/src/brand-vars.ts`. The active design system rewrites
  `--font-brand`, `--font-mono`, `--radius`, `--space` and the whole brand
  theme block at runtime, unlayered.
- `docs/design-tokens.md` (the DTCG contract) and `docs/beatrice-warde.md`
  (the typographic stance).

Motion: `--dur-1/2/3` (.12/.18/.3s), `--ease-out`, `--ease-spring`. Jelly
soft-body controls, wobbly windows and the mesh warp are opt-in flags in
`feature-flags.ts`, default off. Never assume them and never gate a fix on
them.

## Standing rules

These came from Andy, more than once each. Constraints, not suggestions.

- **No accent-coloured border on a rounded shape.** Not one-sided, not all
  sides. Carry emphasis with a tinted fill or a soft shadow. A neutral
  hairline is fine. A transient accent border on hover or focus is fine.
- **A dashed border means "drop here" and nothing else.** Not empty, not
  invalid, not optional, not out of range.
- **Brand fonts only, through variables.** `var(--font-brand)`,
  `var(--font-mono)`. Never a hardcoded family.
- **Escape closes every overlay.** A nested popover closes itself first and
  stops propagation. Every dialog goes through `components/modal.ts`.
- **Never fight browser or user defaults.** No click, scroll or right-click
  interception for effect.
- **Accessibility prefs are additive and chrome-only.** With nothing on, the
  page is byte-identical. Never CSS `zoom`. Reduced motion drops movement,
  keeps opacity and colour, never mutes audio.
- **Vernacular.** No em dashes, no section signs, no filler phrases. Comments
  and UI copy are gated by ratchets (`check:code-comments`,
  `check:ui-copy`). A new file must be clean.
- **User-facing words.** "Design system", not "brand", unless the brand is
  the subject. No possessives on design material ("Fonts", not "your
  fonts"). "Saved tool session". "Collab" with two Ls.
- **Sidebar interaction contracts** (the comments in
  `views/tool-inputs.ts` explain each): composite rows are `div role=group`,
  never `<label>`; block text and number fields stay native because the
  block editor rebuilds each keystroke and needs native caret restore;
  sliders report through `aria-valuenow` so a commit does not rebuild the
  panel; `.input-section` clips with `overflow: clip`, never clip-path.

## `review [target]`

Judge. Do not rebuild. Report findings and a verdict; fix only when asked.

1. **Scope and intent.** Bound what is under review: a surface, a component
   or the branch's chrome diff. The intent is fixed. The sidebar is a peer
   list of controls beside the real focal point, the canvas. The profile is a
   settings page a returning user scans by section. Review against that,
   never against a dashboard ideal.
2. **See the whole.** Look at the rendered thing before the lines. Use the
   Chrome extension on `localhost:5173`, or the vector shots in
   `docs/shots/`. Squint. Can you tell label from value from help without
   reading? Does one section read denser than the next for a reason? Does
   anything jump?
3. **Lenses, one at a time.**
   - **A. Scan hierarchy.** Label, value, help and section head are four
     tiers, told apart by weight and colour before size. In a form the focal
     element is the control the user is on, so check the focus-within
     spotlight and the focus ring, not a hero.
   - **B. Type and colour.** Sizes from `--fs-*` or `--ui-type-*`. Tracking
     from `--ui-type-tracking-*`. Families from the brand variables. One
     accent, `--primary`, used for action, selection and focus. Muted text
     from `--ui-color-text-muted`.
   - **C. Surfaces and depth.** Every lift spells a `surfaces.css` level or
     its tokens. Borders are `--edge*` or `hsl(var(--border))`. Inputs sit
     inset, controls sit proud, popovers float. Nested rounded shapes keep
     concentric radii.
   - **D. Rhythm and density.** Spacing on `--sp-*`. Rows breathe at
     `--sp-7`; a section groups tighter. Off-grid literals and one-off
     paddings are findings.
   - **E. States, polish, motion.** Hover, active, focus-visible, disabled,
     invalid (`:user-invalid`), loading, empty. Numbers that change get
     `tabular-nums`. Hit areas: 24px minimum, `--ui-size-target` (44px)
     where the row can afford it, and on coarse pointers a padding plus
     negative-margin extension where it cannot (see `.help-tip-btn`).
     Transitions name their properties and use the tokens.
   - **F. Reuse and structure.** Native element, then `fields.css`, then
     `.btn`, then `mountModal`, then `helpTip`. A hand-rolled control beside
     an existing one is a blocker. Negative margins undoing padding,
     escape-hatch calc and absolute positioning to dodge flow are findings.
   - **G. Words.** Read every visible string as a first-time user. Plain
     verbs, sentence case, the vocabulary above.
4. **Score, then filter.** Blocker (reads broken or generic, or breaks a
   standing rule), should-fix, note. Drop taste. Drop bold-but-motivated
   choices. Drop lines outside scope. Drop anything the token files or
   `surfaces.css` already decide. Drop lint's job.
5. **Report.** For each finding: what defaulted, what it costs, the specific
   fix stated as a decision. Then the verdict.

Approval bar: passes the squint, tiers are legible, every literal traces to a
token, one committed surface treatment per element, complete states,
sub-300ms motion on the tokens, nothing hand-rolled beside a primitive, no
standing rule broken, copy in the house vocabulary.

## `deslop [target]`

Surgical, behaviour-preserving, inside the diff or the named surface.

**Pass 1, squint the render.** No focal control, flat tiers, every row
identical when the manifest says otherwise, colour smeared, structure drawn
with lines instead of space. Fix the compositional one first. Note what is
too structural for a surgical pass and hand it to `review`.

**Pass 2, scan the lines.** Literals that have a token: `--sp-*`, `--fs-*`,
`--ui-type-tracking-*`, `--radius-*`, `--dur-*`, `--ease-out`, the surface
tokens. `transition: all` to named properties. Proportional digits on a live
readout to `tabular-nums`. A duplicated box recipe to `fields.css` or
`.btn`. Missing states. A dashed border that is not a drop area. An accent
border on a rounded shape. A hardcoded family. Off-grid paddings. A hit area
under 24px.

**Output.** A table grouped by category, Before and After, one row per fix,
file and property named. Compositional fixes first. One or two closing
sentences. Hand anything structural to `review`.

**Guardrails.** Match the surrounding sheet. Never add a `border-radius: Npx`
literal or a `calc(Npx * var(--a11y-fs))` font size: `primitive-guards.test.ts`
R12 counts both ways. Never hand-edit a generated block: edit the JSON and run
`pnpm run gen:chrome-tokens`. Do not put a `.field-*` class on a view rule
without deleting the duplicate paint.

## Not slop here

A generic checklist would flag these. Leave them.

- The sidebar's translucent card plus backdrop blur over the stage. That is
  the signature, not a fragmented surface.
- The ring-plus-drop shadow on every theme, dark and brand included. Not a
  mixed depth strategy.
- Glass buttons and frosted pills.
- Uppercase, tracked, muted labels at `--fs-xs`. The house eyebrow; the
  tracking token exists for it.
- Native `<select>` with arrow-key cycling, native date and time inputs with
  flatpickr, styled through `fields.css`. Never replace them with a custom or
  framework primitive.
- Token names in the shadcn convention. Never rename them for evocativeness;
  the design-system pack and the Penpot round-trip write them.
- The focus-within spotlight that dims sibling rows to .7.
- Jelly, wobble and the neurospicy effects when their flag is on.
- Brand-hued chrome and the rainbow landing.

Also do not: add `scale(.97)` press feedback across the board (motion the
a11y contract has to gate, and a generic tell in its own right); flatten the
sidebar onto the canvas background; strip shadows on dark themes; add a sixth
elevation level; create a `system.md`; ask "does this direction feel right?"
on routine work. Make the routine calls and report them.

## Surface notes

**Tool input sidebar.** Hierarchy comes from the manifest, not from per-tool
CSS: `section`, `blocks`, `showIf`, `display: 'slider' | 'segmented' |
'pill'`. If a tool's sidebar reads flat, the fix may be a manifest edit in
`community/<id>/tool.json` (then `pnpm run build:catalog:all`), not a style.
Labels float on text fields; `input-row--static-label` opts out. Help lives
behind the info button. The mobile sheet lives in `tool-chrome.css`. Verify
on a tool with sections, blocks and sliders: `meeting-planner`, `chart`,
`design`.

**Profile settings.** A sticky nav rail with search and scroll-spy, `?focus=`
deep links, sections listed in `views/profile/shared.ts` (`NAV_SECTIONS`).
Cards are `.profile-card`, each with a collapse body. Identity fields are
form-associated; flag rows may render as jelly switches with explicit `for`
and `id`. When a dashboard glance moves here it arrives as a section with an
id, an icon, a label and search keywords, and the dashboard keeps mirroring
it until Andy retires that tile. Tests: `views/profile-nav.test.ts` and the
a11y contract.

## Verify

CSS has no typecheck. Run the pins that watch these sheets:

```
node --test tests/chrome-tokens.test.ts
node --test shells/web/src/primitive-guards.test.ts
node --test shells/web/src/lib/a11y-prefs-contract.test.ts
node --test shells/web/src/views/design-ui-contract.test.ts
node --test shells/web/src/components/color-field.test.ts
node --import ./tests/css-stub.mjs --test shells/web/src/views/profile-nav.test.ts
```

A view test whose import graph reaches a `.css` file needs the css stub
(`--import ./tests/css-stub.mjs`, what `scripts/run-test-suite.ts` passes);
bare `node --test` fails it with an unknown-extension error, which is not a
finding.

Then look at it in a real browser at desktop width and at 640px: a tool is at
`localhost:5173/t/<id>`, the settings page at `localhost:5173/#/profile`.
Read the computed style of a changed rule, not just the screenshot, so a
token that failed to resolve cannot hide behind a similar-looking fallback.
A green run without a look means "not exercised".
