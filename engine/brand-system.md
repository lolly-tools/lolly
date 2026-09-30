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

Start's **Usage & rules** room preserves the brand's role names and maps each rule
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
