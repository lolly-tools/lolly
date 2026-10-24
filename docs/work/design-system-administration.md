# Design-system administration

This page is for the owner or admin who chooses which design system a Lolly Work deployment
serves, replaces or retires one, and connects its published rules to tools. Members' apps and
server renders all use the one design system you select here.

Two words matter on this page:

- A **source** is one installed design system: a mounted catalog, a content profile in a mounted
  checkout, a connect download or a provider.
- A **connect download** is the instance pack (`/connect/pack.lolly`) that members' apps can
  download to work with the deployment's design system offline.

::: figure work-ds-sources
Several installed sources, one active selection and the apps and renders that use the selection.
:::

A deployment that serves several brands, a co-brand or a white-label system installs several
sources and selects one at a time. [Brand
architectures](https://lolly.tools/info/create/brand-architectures.html) describes those
arrangements.

## What members get

Open **This Deploy → Design system** to inspect the installed sources and review a change. The
selected source supplies the tokens, chrome, catalog responses, rendering and collaboration
admission for everyone. Providers keep their own controls on **This Deploy → Providers** and
never select the deployment default.

A member's local edit in Lolly stays on their device. Opening the editor does not publish
anything to the server, and removing a local copy does not remove mounted files, other members'
copies, sessions or uploads.

Work has no colourway setting of its own. It serves the selected source's tokens as they are,
and server renders and their evidence do not record a colourway.

A missing active source is shown as unavailable. Work serves an empty catalog for it and keeps
these controls reachable, so an owner or admin can select an installed replacement. No unrelated
source is substituted automatically.

## Review and apply

Every change is previewed first, then applied with the preview's token:

::: timeline
- <!--i:search--> **Preview.** Send the change to `POST /api/v1/brand/changes/preview`. The answer lists blockers, required permissions, impact, a `revision` and a `reviewToken`.
- <!--i:checklist--> **Review the impact.** Departing tools and assets, shared IDs whose content changes, token and logo changes and counts of affected sessions, links, published assets and version metadata.
- <!--i:check--> **Apply.** Send the same change with that `revision` and `reviewToken` to `POST /api/v1/brand/changes`. Permissions and impact are checked again.
- <!--i:clock--> **Review again if something moved.** A concurrent change, or changed impact, answers `409 STALE_PREVIEW`.
:::

```json
{"action":"retire","sourceId":"profile:alpha","replacementId":"profile:beta"}
```

| Action | Permission | Effect |
|---|---|---|
| `select` | `brand.switch` | select an installed, valid source that is not retired |
| `retire` | `instance.config`, and also `brand.switch` when the source is active | prevent new selection; an active source needs a valid replacement |
| `restore` | `instance.config` | make an installed retired source selectable again |
| `stop-download` | `instance.config` | keep the connect download suppressed |
| `enable-download` | `instance.config` | offer the kept download again, only when it matches the current source |

Download actions use `"sourceId":"download"`. Explicit deny grants win. The older routes
`PUT /api/v1/brand/profile` and `DELETE /api/v1/instance-pack` use the same service, permissions
and atomic state change.

Private device documents, and references inside binary files, cannot be counted. Source files,
stored versions, sessions and uploads are kept. A catalog change can make an existing reference
unavailable or change a shared ID's appearance, so review those counts before applying.

`GET /api/v1/brand/profiles` lists what is installed, for members with `catalog.read`. It keeps
`available`, `active` and `profiles` for older clients, and adds `sources`, `activeSource`,
`revision`, `contentRevision`, `persistence`, `mutable` and `limitation`. Source descriptors
include identifiers, labels, tokens heads, namespaces, diagnostics and the operations the caller
may perform; filesystem paths and provider credentials are left out.

The CLI uses the same review contract:

```sh
lw brand
lw brand preview retire profile:alpha --replacement=profile:beta > brand-review.json
lw brand apply brand-review.json
lw brand preview stop-download download > download-review.json
lw brand apply download-review.json
```

## Downloads for connected apps

Build instance packs with Lolly's `scripts/build-instance-pack.ts`. Work checks the instance
address and the opaque tokens document against the selected source, and keeps the uploaded
archive bytes exactly as they are: signed bytes are never rewritten. Verifying the signature is
the importing client's job, and Work's `signed` flag only reports that `pack.sig` is present.
Unsigned uploads are allowed only in development mode.

- Changing the default withdraws a download bound to another source or source revision. Upload a
  matching pack before offering downloads again.
- Stopping a download keeps its blob, and the suppression survives a restart. A successful upload
  or an explicit enable clears the suppression.
- Restoring and selecting the original, unchanged source can make its kept download usable again,
  unless it was explicitly suppressed.

The public instance descriptor and the authenticated org configuration carry a branding revision,
for a neutral source too. Catalog and brand responses revalidate caches, and render keys include
the revision. Each request and render attempt resolves one source snapshot, and Chromium workers
must acknowledge the same revision and use this Work instance as their web origin. An older
worker, or a revision change during its fetches, fails the render; retry after upgrading or
refreshing.

New Lolly clients check again on focus and reconnect when the server advertises revisions. A view
that is safe to refresh uses the existing catalog, token and font refresh. An open tool, or an
editable local copy, gets a notice instead: refreshing never discards work or overwrites that
copy. Offline clients keep their last-known material and source information, and older servers
without the field keep their earlier refresh behaviour.

## Managed production rules

**Usage & rules** shows the design system's published guide and, for policy editors, a reviewed
mapping from the guide's example roles to installed tool inputs. Brand labels stay separate from
Lolly's interface roles. Select a tool, choose the matching example and token mode, then connect
only inputs that serve those purposes. The review shows required input coverage separately for
each output format before you apply.

`GET /api/v1/brand/rules` needs `catalog.read`. `POST /api/v1/brand/rules/preview` and
`POST /api/v1/brand/rules` need `policy.edit`, checked again on apply. Preview takes
`{ mappings }`, and apply adds the returned `revision` and `reviewToken`. Each mapping has
`toolId`, `example`, `mode` and `fields` (optional `accent`, `type`, `device`, `heading` and
`body` input IDs). Empty mappings remove managed connections, and invalid or duplicate mappings
are refused.

Mappings belong to one source. They bind the mounted source and tool manifest digests, and commit
with an audit event through the brand-state compare-and-swap; they never rewrite the guide or the
tool manifest. A source or mapped manifest change needs a new review. Unchanged earlier packs
without a guide keep their previous behaviour, and future guide versions are kept with unknown
required coverage.

**How rules are enforced.** The shared engine evaluates supported rules, and Work checks actual
runtime input digests when an export is made; signed worker evidence must also match the fetched
source. Facts supplied in the request cannot satisfy those checks. Your organisation's locks,
choices, formats and permissions ([governance](governance.md)) stay authoritative: projected
choices intersect those restrictions, and governed defaults and hook-produced values are checked
too. Conditional format rules are enforced per render, without being shown as unconditional
interface restrictions.

**What a member sees.** A confirmed required violation blocks the output. Missing required facts
produce a visibly marked **DRAFT**, for synchronous, durable, batch and earlier job renders alike.
Durable output metadata records the rule disposition, the `runtime-inputs` scope and the revision,
and downloads carry `x-lolly-brand-check` and a draft filename. Reports bind to the output receipt
and include the rule results.

A checked input report is not a visual or brand approval: pixel colours, actual font rendering,
geometry and visible fixed artwork need separate observations ([what a receipt does not
prove](renders.md#what-a-receipt-does-not-prove)). Fixed-artwork inputs can be constrained, but
their visible presence stays unknown, and so does a changed text value with no observed length.
Each render attempt uses one source revision and refuses a concurrent source or policy change
before returning its bytes. Historical receipts describe their original attempt, not current
approval.

## Roll back

To roll back, restore a retired source if needed, preview selecting it, then apply. Review and
re-enable its matching download separately. Physically deleting a source is an operator task,
after checking kept references, backups and offline copies, and never a side effect of retiring
the source.

## Operator notes

### Sources and storage

`instance.pack` accepts a materialized `tools/` and `catalog/` tree, a checkout with
`profiles.json`, or the older `brands/<name>/catalog` layout. The canonical Lolly resolver handles
content profiles, shared asset roots and tool overlays. Work creates private temporary views and
never rewrites the mounted catalog or its `.lolly-profile` marker. Mounted files do not change for
the lifetime of the process: validate and redeploy all replicas after changing their contents.

The durable decision is separate from the deployment's boot default. Migration
`0037_brand_state.sql` stores the active source, retired sources, download suppression, a
content-addressed download pointer and an increasing decision revision. PostgreSQL commits each
decision with its audit event in one transaction. All replicas must share the database and the
download blob store, and mount the same source contents.

Production changes need PostgreSQL. An in-memory production instance shows the inventory and an
operator explanation, with changes blocked. Development mode allows temporary changes and labels
their lifetime in the console. A configured download can still seed a fresh read-only deployment,
but an ordinary restart cannot clear a durable suppression decision. PostgreSQL and shared blob
storage keep decisions across replicas, and the additive rules record needs no new migration.

### Choose a tokens head

Work selects one independent tokens head automatically, and published descendants of that head are
excluded. Several independent heads produce a diagnostic. Set `brandTokens` in the source's asset
index, or map sources to assets explicitly:

```json
{
  "instance": {
    "brandTokens": {
      "profile:alpha": "alpha/tokens/brand",
      "mounted": "company/tokens/brand"
    }
  }
}
```

An explicit `"brandTokens": null` in an asset index describes a neutral source. Work never assumes
that a neutral replacement is installed.

::: details Release order and the vendored resolver
Apply migrations, deploy the additive server API and a compatible Chromium worker, then deploy the
updated Lolly shell. Turn on production changes only with durable storage.

The source adapter uses a checksum-pinned copy of Lolly's Node resolver.
`node scripts/vendor-content-resolver.ts --write` refreshes that copy from the committed
`vendor/lolly` submodule, and `verify:engine-pin` verifies the resulting pin alongside the engine
and core. Do not patch vendored files.

Hosted guide sites and general document rule evaluation are not built.
:::
