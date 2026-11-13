# Telemetry and dashboards

Lolly Work can count what people do in Lolly so admins can see which tools are used and what gets
exported. It never records what anyone typed or made: each event carries a short, fixed list of
labels, such as a tool id or a file format.

::: note Lolly's own apps do not send these events today
Lolly Work accepts them, checks them and charts them, and the consent route exists. But the web
app, the desktop and mobile apps, the command line and the terminal app never post to
`/api/v1/telemetry`, and none of them asks a person for consent. The usage charts in the console
therefore stay empty unless a client of your own sends events. This page describes what Lolly
Work does with events that arrive, for such clients. The audit log, the activity feed's audit
half and the Fleet view do not depend on these events.
:::

Whether an event identifies the person is your choice. With the defaults (`telemetry: "standard"`,
`telemetryAttribution: "opt-in"`), events stay anonymous until that person agrees through the
consent route. Set `telemetry: "aggregate"` to never store a name, or `"off"` to store nothing at
all.

::: figure work-telemetry-ingest
Every event passes the same checks at ingest, in this order, before anything is written.
:::

<!--i:eti-shield-check-->
## The rules at the door

Lolly Work enforces three rules when an event arrives, not later in the query layer, where a mistake
would already have stored the data:

1. **No input values, ever.** Each event type has a closed allowlist of labels; anything else is
   dropped before storage. A surviving value is coerced to a string, and one longer than 200
   characters is dropped, so a label cannot carry content.
2. **Attribution applies at ingest.** Below `standard`, or at `standard` with
   `telemetryAttribution: "opt-in"` when the person has not agreed, the user id is stripped.
   Those events are anonymous from the first byte.
3. **Only contact fields in a profile update.** `profile.update` keeps, in its `fields` label,
   only the names of eight contact fields: `firstname`, `lastname`, `email`, `phone`, `title`,
   `city`, `country` and `headshot`. Any other field name, such as a preference or a consent
   flag, is dropped; an update that changed none of the eight is stored with no `fields` label.

<!--i:eti-sliders-->
## Levels and consent

| Policy | What is stored |
|---|---|
| `telemetry: "off"` | nothing; ingest drops every event |
| `telemetry: "aggregate"` | events, never with a user id |
| `telemetry: "standard"`, `telemetryAttribution: "opt-in"` (the defaults) | events, with a user id only after that person agrees |
| `telemetry: "standard"`, `telemetryAttribution: "default"` | events with the user id |

Consent is per person, through `POST /api/v1/telemetry/consent`. Lolly Work stores the answer and
honours it when an event arrives. A client that sends events must ask the person itself and pass
the answer on. Both keys are in
[configuration](configuration.md#telemetry-activity-and-retention).

<!--i:eti-checklist-->
## What Lolly Work records from a sending client

| Event | Labels |
|---|---|
| `app.boot` | `shell`, `shellVersion`, `engine`, `platform` |
| `tool.open` | `toolId` |
| `session.save` | `toolId`, `projectId` |
| `render.export` | `toolId`, `format`, `destination`, `approved` |
| `link.create`, `link.visit` | `linkKind` |
| `catalog.asset-use` | `assetId` |
| `catalog.asset-download` | `assetId`, `via` (`direct` / `link` / `zip`) |
| `approval.requested` / `approved` / `rejected` | `chainId`, `step` |
| `profile.update` | `fields` (field names, from the eight contact fields above) |
| `collab.join` | `toolId` |
| `session.tool` | `toolId`, `seconds` |
| `session.shell` | `shell`, `seconds` |

An unknown event id is dropped. `seconds` is a numeric label for
seat-utility rollups. No label anywhere in the list holds free text, so the first rule holds
without anyone having to review what is sent.

Clients send events to `POST /api/v1/telemetry`, rate-limited per IP (`rateLimit.telemetry`, default
capacity 120, refill 4 a second).

<!--i:eti-gauge-->
## Dashboards

The console turns these events, and the audit log, into four views. The routes behind them are
in the [API reference](api.md#telemetry-activity-audit-fleet-and-setup).

| View | Route | Action |
|---|---|---|
| Overview stats | `GET /api/v1/stats/overview` | `telemetry.view` |
| Rollup summary | `GET /api/v1/telemetry/summary` | `telemetry.view` |
| Activity feed | `GET /api/v1/activity` | `audit.export` |
| Fleet | `GET /api/v1/fleet` | `fleet.view` |

**Overview** leads with a role-aware "what needs me" panel, then popularity and export figures
over the last 14 days, with a data table under every chart.

![The admin console overview: 14-day activity, what needs attention, top tools and fleet](shots/overview-dashboard.svg)

**Activity** is one timeline over two existing records: the audit log (the authoritative "who
did what") and *attributed* usage telemetry, meaning only events that carry a user id, so the
feed can show who acted. Nothing new is collected to build the feed. With no client sending
events, the feed shows the audit log alone. It offers facets for category and actor.

![The activity feed: a linear, readable record where every noun links back](shots/activity-timeline.svg)

**Fleet** answers "which Lolly versions are talking to this deploy" from the `X-Lolly-Client`
header that Lolly's apps add to their requests, not from telemetry events: shell, shell version, engine version, platform, request counts and last seen. Publish
checks and upgrade nudges start there, and message targeting can then pick an audience by
groups, shell and engine-version range ([messages](api.md#approvals-and-inbox)).

![The client fleet: which shell and engine versions are talking to this deployment](shots/client-fleet.svg)

<!--i:eti-download-->
## Downloads and what members see

What the deploy shows members about its own measurement is a policy choice, and the console
states its posture in the interface rather than hiding it: an internal deploy shows utilisation
in full.

Since Lolly 1.2.0, when a Lolly Work workspace is connected, the app's first-run privacy line
says what the workspace keeps: what a person saves to its projects or shares through it, and a
log of their sign-ins and what they do there. Without a workspace, nothing changes.

Downloads are measured per item: a client sends
`catalog.asset-download` when a catalog asset leaves as a file, with a coarse `via` label
(`direct`, `link` or `zip`) and no file name. The Overview shows "Most-downloaded catalog items"
beside "Most-used" (assets opened or placed).
Downloads follow the same attribution rule as every other event. Transforms and crops count as
tool activity, not a separate event, and the console says that on the page.

<!--i:eti-monitor-->
## Prometheus

`GET /metrics` exposes gauges for the audit-chain integrity flag, process uptime and memory (RSS), live
rate-limit buckets, per-provider enabled state, asset count and last error, and blob bytes
stored by driver. Its counters cover HTTP requests, blob bytes read by driver and response bytes
by delivery class. Two gauges appear only when they apply: `lw_siem_lag` (audit events the SIEM
receiver has not yet confirmed) while `siem.url` is set, and `lw_provider_credential_expiry_days` for a provider whose credential has a stated
expiry. Every series is an aggregate: none identifies a person, a blob or a request.

With `LW_METRICS_TOKEN` set, the endpoint needs that bearer token. Without one, only loopback
may read the metrics, and only on an evaluation instance with no proxy: in production, behind
`proxyAuth` or with `rateLimit.trustedProxyHops` above `0`, the endpoint answers `404`. The
route is registered before sign-in checks, so no other route can shadow `/metrics`. Which gauges
to alert on is in [operations](operations.md#monitoring), and
[metrics and alerts](metrics.md) lists every series.

The same series can also be pushed over OTLP to a platform team's OpenTelemetry
Collector, beside traces and logs. That export is off unless an endpoint is set, and it
carries no usage events and nothing about identity; see
[OpenTelemetry export](operations.md#opentelemetry-export).

<!--i:eti-link-->
## Related

- The authoritative record of governed actions: [audit log](audit.md)
- Every telemetry and retention key: [configuration](configuration.md#telemetry-activity-and-retention)
