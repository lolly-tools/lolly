# Design-system administration

Open **This Deploy > Design system** to inspect the installed sources and review a change. A source is a mounted catalogue, a content profile, a connect download, or a provider. Providers keep their existing Sources controls; they do not select the deployment default.

A local Lolly edit stays on that device. Opening the editor does not publish changes to the server. Removing a local copy does not remove mounted files, other members' copies, sessions or uploads.

## Sources and storage

`instance.pack` accepts a materialized `tools/` and `catalog/` tree, a checkout with `profiles.json`, or the older `brands/<name>/catalog` layout. The canonical Lolly resolver handles content profiles, shared asset roots and tool overlays. Work creates private temporary views and never rewrites the mounted catalogue or `.lolly-profile` marker. Mounted files are immutable for the lifetime of the process: validate and redeploy all replicas after changing their contents.

The durable decision is independent of the deployment's boot default. Migration `0037_brand_state.sql` stores the active source, retired sources, download suppression, content-addressed download pointer and monotonically increasing decision revision. Postgres commits each decision and its audit event in one transaction. All replicas must share the database and download blob store and mount the same source contents.

Production mutations require Postgres. An in-memory production instance exposes inventory and an operator explanation, with mutations blocked. Development mode permits temporary changes and labels their lifetime in the console. A configured download can still seed a fresh read-only deployment; an ordinary restart cannot clear a durable suppression decision.

A missing active source is shown as unavailable. Work serves an empty catalogue for that source and keeps the administration controls reachable so an owner or administrator can select an installed replacement. No unrelated source is substituted automatically.

## Choose a tokens head

One independent tokens head is selected automatically; published descendants of that head are excluded. Multiple independent heads produce a diagnostic. Set `brandTokens` in the source asset index, or configure an explicit source-to-asset mapping:

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

An explicit `"brandTokens": null` in an asset index describes a neutral source. Work never assumes that a neutral replacement is installed. Tokens, chrome, catalogue responses, rendering and collaboration admission use the selected source.

## Review and apply

`GET /api/v1/brand/profiles` requires membership and `catalog.read`. It retains `available`, `active` and `profiles` for older clients, and adds `sources`, `activeSource`, `revision`, `contentRevision`, `persistence`, `mutable` and `limitation`. Source descriptors include identifiers, labels, tokens heads, namespaces, diagnostics and per-caller operations. Filesystem paths and provider credentials are excluded.

Send a change to `POST /api/v1/brand/changes/preview`:

```json
{"action":"retire","sourceId":"profile:alpha","replacementId":"profile:beta"}
```

The response includes blockers, required permissions, impact, `revision` and `reviewToken`. To apply, send the same change plus that revision and token to `POST /api/v1/brand/changes`. Permissions and impact are checked again. A concurrent change or changed impact produces `409 STALE_PREVIEW`; review again before applying.

| Action | Permission | Effect |
|---|---|---|
| `select` | `brand.switch` | Select an installed, valid, non-retired source |
| `retire` | `instance.config`; also `brand.switch` when active | Prevent new selection; an active source requires a valid replacement |
| `restore` | `instance.config` | Make an installed retired source selectable again |
| `stop-download` | `instance.config` | Persist suppression of the connect download |
| `enable-download` | `instance.config` | Re-offer retained bytes only when they match the current source |

Download actions use `"sourceId":"download"`. Explicit deny grants win. The compatibility routes `PUT /api/v1/brand/profile` and `DELETE /api/v1/instance-pack` use the same service, permissions and atomic state transition.

Impact reports departing tools/assets, shared IDs whose content changes, tokens and logo changes, and counts of affected sessions, links, published assets and version metadata. Private device documents and references embedded inside binary files cannot be enumerated. Source files, stored versions, sessions and uploads are retained. A catalogue change can make an existing reference unavailable or change a shared ID's appearance; review those counts before applying.

The CLI uses the same review contract:

```sh
lw brand
lw brand preview retire profile:alpha --replacement=profile:beta > brand-review.json
lw brand apply brand-review.json
lw brand preview stop-download download > download-review.json
lw brand apply download-review.json
```

## Downloads, refresh and rollback

Build instance packs with Lolly's `scripts/build-instance-pack.ts`. Work checks the instance address and the opaque tokens document against the selected source, and preserves the uploaded archive bytes exactly. Signed bytes are never rewritten. Signature verification remains the importing client's responsibility; Work's `signed` flag reports the presence of `pack.sig`. Unsigned uploads are limited to development mode.

Changing the default withdraws a download bound to another source or source revision. Upload a matching pack before re-enabling distribution. Stopping a download retains its blob and suppression survives restart. An explicit successful upload or enable operation can clear suppression. Restoring and selecting the original unchanged source can make its retained offer usable again, unless it was explicitly suppressed.

The public instance descriptor and authenticated org configuration carry a branding revision, including for a neutral source. Catalogue and brand responses revalidate caches; render keys include the revision. Requests and render attempts resolve one source snapshot. Chromium workers must acknowledge the same revision and use this Work instance as their web origin. An older worker or a revision change during its fetches fails the render; retry after upgrading or refreshing.

New Lolly clients recheck on focus and reconnect when the server advertises revisions. A safe view refreshes using the existing catalogue, token and font refresh functions. An open tool or editable local copy receives a notice; refresh does not discard work or overwrite that copy. Offline clients keep their last-known material and source information. Older servers lacking the field retain their existing refresh behaviour.

To roll back, restore a retired source if necessary, preview its selection, then apply. Review and re-enable its matching download separately. Physical deletion is an operator task after checking retained references, backups and offline copies, never a side effect of retirement.

## Release order

Apply migrations, deploy the additive server API and compatible Chromium worker, then deploy the updated Lolly shell. Enable production mutations only with durable storage. The source adapter consumes a checksum-pinned copy of Lolly's Node resolver; `node scripts/vendor-content-resolver.ts --write` refreshes that copy from the committed `vendor/lolly` submodule, and `verify:engine-pin` verifies the resulting pin alongside the engine and core. Do not patch vendored files.

## Managed production rules

**Usage & rules** shows the published guide and, for policy editors, a reviewed mapping from its example roles to installed tool inputs. Brand labels remain independent of Lolly's UI roles. Select a tool, choose the matching example and token mode, and connect only inputs that serve those purposes. Review shows required input coverage separately for each output format before applying.

`GET /api/v1/brand/rules` requires `catalog.read`. Both `POST /api/v1/brand/rules/preview` and `POST /api/v1/brand/rules` require `policy.edit`, checked again on apply. Preview accepts `{ mappings }`; apply adds the returned `revision` and `reviewToken`. Each mapping has `toolId`, `example`, `mode` and `fields` (optional `accent`, `type`, `device`, `heading`, `body` input IDs). Empty mappings remove managed connections. Invalid or duplicate mappings are refused.

Mappings are source-specific, bind the mounted source and tool manifest digests, and commit with an audit event using the existing brand-state compare-and-swap. They do not rewrite the guide or tool manifest. A source or mapped manifest change requires review again. Unchanged legacy packs without a guide keep their previous behaviour. Future guide versions are retained with unknown required coverage.

The shared engine evaluates supported rules. Work checks actual runtime input digests at the export boundary; signed worker evidence must also match the fetched source. Request-supplied facts cannot satisfy those checks. Existing organisation locks, choices, formats and permissions remain authoritative. Projected choices intersect those restrictions, and governed defaults and hook-produced values are checked too. Conditional format rules are enforced per render, without being presented as unconditional UI restrictions.

Confirmed required violations block output. Missing required facts produce a visibly marked **DRAFT**, including synchronous, durable, batch and legacy-job renders. Durable output metadata includes the rule disposition, `runtime-inputs` scope and revision; downloads also carry `x-lolly-brand-check` and a draft filename. Reports bind to the output receipt and include the rule results. A checked input report is not visual or brand approval: pixel colours, actual font rendering, geometry and visible fixed artwork need separate observations. Fixed-artwork inputs can be constrained, but their visible presence remains unknown here. A changed text value without an observed length also remains unknown.

Each render attempt uses one source revision and refuses a concurrent source or policy change before returning its bytes. Historical receipts describe their original attempt, not current approval. PostgreSQL and shared blob storage retain decisions across replicas; no new migration is needed for the additive policy record. Hosted guide sites and general document rule evaluation remain separate work.
