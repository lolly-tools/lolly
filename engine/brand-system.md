# Brand vocabulary and rule records

The `BrandSystemV1` contract describes a brand's own vocabulary and production
rules. The record reader validates data; the separate `brand-rules.ts` evaluator
checks four bounded predicates through explicitly named example adapters.

The SDK exports `@lolly-tools/core/brand-system-v1` and the matching JSON schema.
`engine/src/brand-system.ts` validates the schema, unique identities and local
references. Malformed data or a future schema version returns `null`. Raw token
storage retains the original extension even when this reader cannot use the
record.

Store the record at `$extensions["com.suse.lolly"].brandSystem`. The existing
extension namespace is a compatibility contract. Brand identities and labels
remain independent of that namespace.

## Names and bindings

A role has an immutable `id`, a user-facing `label`, optional grouping and
resource references. Labels may repeat or use any language. A role may refer to
one or more token paths or asset IDs. A device can be represented by an asset
role; the model does not impose a universal catalogue of device names.

A binding names a consumer slot and a role ID. Its optional tool and mode scope
limits that mapping. A brand's “Beacon” role can bind to a poster accent without
renaming the token or requiring every tool to consume that role. Lolly's own UI
roles remain separate.

`guide.groups` provides optional presentation order using stable role and rule
IDs. It is independent of the studio rooms and contains no HTML or executable
content. A future guide exporter can use these same groups.

## Colour roles

A role with `group: "colourway"` names a colour in the brand's own words. Its value lives per colourway and per look at `color.colourway.<mode>.<id>`, and `color.semantic.<id>` links to it, so `--brand-<id>` paints and `{color.semantic.<id>}` resolves in a colour field. A role with any other group is left alone by everything in `engine/src/colour-roles.ts`.

A binding with `consumer.slot` set to one of the six slots a role can fill (`primary`, `secondary`, `surface`, `text`, `muted`, `edge`) and no `tool` says what Lolly reads the role as. The binding is also written into the tokens: inside each colourway set, `color.colourway.<mode>.<slot>` holds an alias to the role. Every existing reader of a slot therefore keeps working unchanged, and changing the mapping moves aliases and no values. Binding `primary` moves `on-primary` to the role's on-colour too, unless the file states its own. A role that fills no slot is read by name only: no tool picks it by itself.

A role's id is permanent and uses lowercase letters and hyphens, because `--brand-<id>` needs that. A slot's own name is allowed, and the role is then that slot with no alias. `on-*`, `token-*`, `warn`, `warn-ink`, `lead-count`, `constructor` and `prototype` are reserved. A label with no Latin letters gets a generated id made of letters. Labels may be in any language, and a rename touches only the label.

On-colours are worked out per role, look and colourway by the rule `on-primary` uses, stored at `color.colourway.<mode>.on-<id>` and marked `colourRole.derived` in the token's vendor extension. An on-colour with no mark is stated in the file, and it wins. A value copied rather than chosen carries `colourRole.seeded`, which is how a surface can say it still needs a choice. Dark can follow light by an alias, shown as "Same as light".

Nothing dangles. Adding or copying a colourway fills every role, removing a role that fills a slot is refused until the slot is let go with its current colour, and a house rule, guide group, tool binding or token that uses a role always refuses its removal. A document with no colour roles comes through every function unchanged, and choosing the shipped words (Primary, Secondary, Surface, Text) writes nothing. Exported files record nothing new: the export record stays design system, version and theme choice.

A colour field offers the declared roles first, in brand order and under their labels, with a pick stored as `{color.semantic.<id>}`. A Design row keeps its literal colour beside the link in `tokenLinks`, so every renderer and older engine still paints it, and the field reads the link for the word. The design brief, `lolly://tokens`, `lolly system status`, a brand page's `AGENTS.md` and the generated baseline skill quote the labels as data with what each role is read as. `host.tokens.family(role)` keeps its meaning, one colour per colourway, so a role that fills no slot joins no tool's palette by itself. A document with no colour roles sees none of this.

What each format keeps is in `colour-role-portable.ts` and listed in [Colour roles in other formats](/info/design-tokens.html#colour-roles-in-other-formats). `adoptColourRoles` is the way back in: given a file's colours and words a person confirmed, it writes the same record, leaves, links and bindings the studio writes. Which word suggests which slot lives in the web shell's review (`shells/web/src/lib/brand-propose.ts`), not in the engine, so no render path can read a word for meaning.

A hand-written file that holds custom colour tokens and declares none reads as `undeclared`: the tokens are listed with `declared: false`, keep working by name and survive every edit, and adding one by its id declares it where it stands. Design documents can refer to a role by `{color.semantic.<id>}`, and Lolly cannot see those references from a token file, so removing a role that a saved document uses leaves that document's colour to report as unresolved.

## Rules and authority

A rule carries a kind, parameters, target role IDs, optional tool/mode/output
scope, and an advisory or required intent. Source evidence and review state are
separate. Manual rules identify their author; source-derived rules identify a
reference and optional locator. Approved records require an authority label.
That label records a declaration; it is not authentication or proof that the
current user can approve a managed policy.

Unknown kinds remain intact. Neither `required` nor `approved` means enforced.
A producer must register a supported kind, validate its parameters, bind targets,
collect the necessary facts and run the relevant checker before making a scoped
conformance claim. Required rules with unknown facts or missing checkers cannot
pass. There is no prose evaluation or arbitrary expression execution here.

The two synthetic fixtures under `tests/fixtures/brand-systems` deliberately use
different names, duplicate labels, custom modes and an unsupported rule kind.
Existing design-context and brand-package envelopes retain these records.
Brand-package export, adoption and published-version pinning follow known asset
references in `roles[].resources`. Export includes the head and readable published
versions, maps those references to portable IDs, and requires brand reader 3 when
such references exist. An archival font referenced by a role travels with
`selected: false` in `fonts.json`; retaining that file does not select it for
current use. Opaque extensions are preserved but their resource graphs are not
interpreted. Plain token JSON cannot supply missing resource bytes.

## Executable example rules

Start's **Rules** room preserves the brand's role names and maps each rule
to a named example, mode and PNG output. Editable systems can save drafts, record
local approval, revise rules and remove rules with a recovery checkpoint. Managed
systems expose the readable guide and examples without authoring controls.

The current adapters are `brand-poster`, `brand-slide-title`,
`brand-slide-content` and `brand-chart`. Their slots are deliberately narrow:

| Kind | Parameters and resources | Checked or constrained field |
|---|---|---|
| `color-choices` | `slot: accent`; roles reference colour tokens | Poster heading colour, slide accent line, or chart palette seed |
| `font-choices` | `slot: type`; roles reference single-family tokens | Resolved families for the example's mounted text |
| `fixed-artwork` | `slot: device`; one asset ID | Included fixed artwork in the Design examples; no Chart adapter |
| `text-length` | `slot: heading` or `body`; integer `max` from 1 to 10,000 | UTF-16 input length, separately from visual fit; Chart has no body slot |

Resource predicates need explicit role-to-slot bindings. Additional parameters,
missing resources, unsupported kinds and missing facts remain unknown. Scopes
outside the selected example, mode or format do not apply. Only required,
locally approved rules block a known violation. An unknown required fact permits
a visibly labelled draft PNG, never a checked or approved result.

The reusable poster compiles applicable required rules into the existing Design
tool policy: approved choices, text limits, fixed layout/artwork and PNG-only
exports. Missing required checks prevent creating that reusable tool. The shared
runtime and CLI input boundary enforce the compiled restrictions; the guide is
not a separate interpreter running in every tool. A downloaded tool contains its
fonts, permitted artwork, credits and a `brand-rules.json` context snapshot. Its
choices remain tied to that revision until the author creates a new file.

Example checks run on a fresh isolated host. Reports bind token/rule and renderer
digests, actual runtime inputs, resolved font-file hashes, shaped glyph coverage,
artwork hashes and mounted text bounds to the exported PNG hash. The PNG is read
back for format, dimensions and readability. These source observations do not
independently identify fonts or all colours in pixels. Glyph overhang, chart
label collisions, complex composition and logo clear space remain unchecked.
Relevant resource or document changes invalidate the displayed result; downloads
render and check the source again. No global brand approval is inferred.

Shared brand governance for arbitrary Design documents, other tools, SVG/PDF and
all MCP/export routes remains a later integration. Existing production inspection
and Design-tool restrictions retain their own coverage and authority.

## Optional managed input checks

The `@lolly/engine/brand-policy` leaf shares the same predicates with lolly-work.
A server-reviewed `BrandPolicyMappingV1` connects an installed tool's declared
input IDs to one named example adapter and mode. Actual tool scopes and explicit
adapter scopes are supported; no brand role is renamed to a platform role.

Work projects applicable required choices into existing organisation policy and
checks exported runtime input digests. Known failures block. Missing required
facts retain visibly marked draft output across render transports. The receipt
names its `runtime-inputs` scope and source revision. It does not certify pixel
colours, rendered fonts, geometry or visible fixed artwork. The worker path
requires signed source-bound observations; caller-provided facts cannot pass a
check. Unsupported guides remain unknown, and legacy packs without guides keep
their previous behaviour.

Policy editors review compatible input mappings and per-format coverage in the
existing styled administration console. Apply rechecks permissions, revision,
source, manifests and organisation policy before the audited atomic update.
Existing locks and narrower choices remain authoritative. These managed checks
do not extend the local shell's generic export coverage or add guide hosting.

## Local adoption and recovery

The web shell prepares an isolated candidate, checks package integrity, validates
font and image decoding, and copies material to fresh asset IDs. A single
IndexedDB transaction commits files, token head, registry record and recovery
receipt. The active pointer participates when activation is requested. Importing
a new system through the front door stores the complete system first, then uses
the normal system switch to activate it and refresh the shell.

Review binds to the expected active system, target record, token head and prior
local dependencies. A later edit or lock change refuses the stale candidate.
Undo restores previous references and font selection after a reload, provided
the system and prior files have not changed. Added files remain in the library.
The recovery receipt is local; it is not part of profile export or sync.

This boundary covers Start token/reference adoption and plain brand packs.
Collection and instance packs still use their existing import paths. File
decoding is an availability check, not glyph coverage, geometric compliance or
brand-rule approval. The public tool host contract has no new adoption service.

## Token compatibility

`tokenCompatibility` reports known resolver gaps without modifying the supplied
document. It covers `$ref`, `$extends`, unresolved aliases and composite values,
active and named selections, and retained extension namespaces. Mode selection
uses the existing Tokens Studio resolver. Separate theme axes retain their
names; the report does not enumerate every possible axis combination.

The scan bounds depth, node count, token count, modes and diagnostics. A limited
scan says so. An empty diagnostic list is neither full DTCG conformance nor a
promise that a selected tool supports every token type. Import consumers can
read the useful subset while keeping the unsupported definitions.

## Reference poster

The web intake renders the public Design poster through the shared row renderer.
A draft host supplies cloned tokens, a pinned preview mode and in-memory state.
It exposes asset reads and blocks library writes, clipboard writes and downloads.
This fixed trusted-tool path is not a general hook sandbox.

The view serialises preview requests, aborts superseded work and discards late
results. Closing the review revokes its image URL. The poster has an explicit
paper surface so Design's transparent export default cannot clear that surface.
Its result is labelled as a preview. Font byte identity, glyph coverage, layout
constraints and brand rules remain unchecked.
