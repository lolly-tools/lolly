# Metrics and alerts

Lolly Work exports Prometheus metrics on `GET /metrics`. This page lists every metric,
the alerts the Helm chart can install and the Grafana dashboard that comes with them.
The alerts and the dashboard are for a platform team that already runs Prometheus and
Grafana, and both are off by default. Without them, Work still raises its own console
alerts for blob offload and credential expiry
([keep Lolly Work running](operations.md#blob-offload-trigger)).

## Scraping

`/metrics` needs a bearer token, `LW_METRICS_TOKEN`, from anywhere except an
evaluation instance's own loopback address:

- with the token set, every request must present it (`Authorization: Bearer ...`), and
  a wrong token gets `401`;
- without the token, an evaluation instance answers on loopback only, and a
  production instance, one behind reverse-proxy sign-in or one with
  `rateLimit.trustedProxyHops` above 0 answers `404` to everyone.

With the Helm chart, set `secrets.metricsToken` (or an `LW_METRICS_TOKEN` key in your
`existingSecret`) and turn on the ServiceMonitor. It reads the token from the same
Secret:

```yaml
metrics:
  serviceMonitor:
    enabled: true
    interval: 30s
    labels:
      release: kube-prometheus-stack   # what your Prometheus's serviceMonitorSelector matches
```

Your own scrape job works as well. Give it the bearer token and see
[selecting the series](#selecting-the-series) for the alerts.

## Metric reference

Counters count from process start, so a restart sets them back to zero; `rate()` and
`increase()` allow for that. A counter, and each of its label combinations, appears
with its first event, so Prometheus can measure an increase only from the second
event on. Gauges are read when Prometheus scrapes.

### Requests and the process

| Metric | Type | Labels | Meaning |
|---|---|---|---|
| `lw_http_requests_total` | counter | `route`, `status` | Requests answered. `route` is the matched route pattern, such as `/api/v1/projects/:id`, or `unmatched`, `csrf-blocked` or `ratelimited:<surface>`. `status` is the class, `2xx` to `5xx`. Kubelet probes and scrapes count too, under `/healthz`, `/readyz` and `/metrics` |
| `lw_rate_limited_total` | counter | `surface` | Requests the per-address limiter refused, by surface: `auth`, `telemetry`, `link` or `automation` |
| `lw_rate_limit_buckets` | gauge | | Client addresses the limiter tracks in memory. When the count reaches `rateLimit.maxBuckets`, the limiter drops the oldest tenth |
| `lw_origin_bytes_total` | counter | `class` | Response body bytes after compression, by delivery class: `public-immutable`, `public-revalidate`, `public-bounded`, `link`, `instance-private` or `person-private`. HEAD, 204 and 304 answers count nothing. A CDN can serve only the public classes |
| `lw_process_uptime_seconds` | gauge | | Seconds since the Work process started |
| `lw_process_resident_memory_bytes` | gauge | | Resident memory of the Work process |
| `lw_org_config_poll_total` | counter | | Configuration polls from Lolly apps that Work answered (200 and 304): how often the fleet checks in |
| `lw_org_config_poll_errors_total` | counter | | Configuration polls Work could not answer |

### Audit and SIEM

| Metric | Type | Labels | Meaning |
|---|---|---|---|
| `lw_audit_chain_intact` | gauge | | `1` when the [audit](audit.md) hash chain verifies end to end, `0` when it is broken. Work verifies the chain at most once every 10 seconds, however often Prometheus scrapes |
| `lw_siem_lag` | gauge | | Audit events the SIEM receiver has not confirmed. Present only when `siem.url` is set ([SIEM forwarding](operations.md#siem-forwarding)) |

### Files

| Metric | Type | Labels | Meaning |
|---|---|---|---|
| `lw_blob_stored_bytes` | gauge | `driver` | Bytes held in the blob store, for `pg` and `memory`. The `s3` driver reports no total |
| `lw_blob_read_bytes_total` | counter | `driver` | Bytes read from the blob store since the process started |

### Catalog sources

One series per source and metric.

| Metric | Type | Labels | Meaning |
|---|---|---|---|
| `lw_provider_enabled` | gauge | `provider`, `kind` | `1` enabled, `0` disabled |
| `lw_provider_assets` | gauge | `provider` | Assets from the last sync |
| `lw_provider_last_error` | gauge | `provider` | `1` when the last sync recorded an error |
| `lw_provider_credential_expiry_days` | gauge | `provider` | Days until the expiry date entered with the credential, negative once that date has passed. Present only where an expiry was entered |

### Notifications, flags and OpenTelemetry

| Metric | Type | Labels | Meaning |
|---|---|---|---|
| `lw_notify_total` | counter | `channel`, `outcome` | Notification deliveries, by `smtp` or `webhook` and `sent` or `failed` ([notifications](operations.md#notifications)) |
| `lw_ofrep_requests_total` | counter | `flag` | Flag evaluations sent to your flag service over OFREP |
| `lw_ofrep_evaluation_errors_total` | counter | `flag`, `reason` | Evaluations that fell back to the value Work governs. `reason` is one of `timeout`, `network`, `unauthorized`, `not_found`, `rate_limited`, `targeting_key_missing`, `invalid_request`, `server`, `status`, `bad_response` or `type_mismatch` |
| `lw_otlp_exported_total` | counter | `signal` | Spans, data points or log records the OTLP receiver accepted. Present only while [OpenTelemetry export](operations.md#opentelemetry-export) is on |
| `lw_otlp_dropped_total` | counter | `signal`, `reason` | Items lost to a full queue (`queue_full`) or a failed export (`export_failed`). Present only while OpenTelemetry export is on |

The render worker exports no metrics. Its health shows in its readiness probe and in
the status of server renders, the `/api/v1/render` and `/render/:spec` routes of
`lw_http_requests_total`.

## Suggested alerts

The chart can install twelve alerts as a Prometheus Operator `PrometheusRule`, next to
the ServiceMonitor:

```yaml
metrics:
  serviceMonitor:
    enabled: true
  prometheusRule:
    enabled: true
    labels:
      release: kube-prometheus-stack   # what your Prometheus's ruleSelector matches
```

| Alert | Severity | Fires when | Reads |
|---|---|---|---|
| `LollyWorkAuditChainBroken` | critical | The audit chain has not verified for a minute | `lw_audit_chain_intact` |
| `LollyWorkNotReady` | critical | Every `/readyz` check in two minutes answered 503, for five minutes | `lw_http_requests_total` |
| `LollyWorkMetricsAbsent` | warning | Prometheus has had no Work series for ten minutes | `lw_process_uptime_seconds` |
| `LollyWorkHighErrorRate` | warning | Over 5% of requests answered 5xx for ten minutes, leaving out health checks, scrapes and renders, at three requests a minute or more | `lw_http_requests_total` |
| `LollyWorkRenderFailures` | warning | Over 10% of server renders (`/api/v1/render` and `/render/:spec`) answered 5xx in 15 minutes, with five renders or more | `lw_http_requests_total` |
| `LollyWorkSiemLagGrowing` | warning | The SIEM backlog has not reached zero and has kept growing for 30 minutes | `lw_siem_lag` |
| `LollyWorkBlobStoreNearOffload` | warning | PostgreSQL (`driver="pg"`) has held over 9 GiB of files for an hour | `lw_blob_stored_bytes` |
| `LollyWorkBlobReadsNearOffload` | warning | At the last day's rate, a 30-day month would read over 90 GiB of files from PostgreSQL, for an hour | `lw_blob_read_bytes_total` |
| `LollyWorkProviderSyncFailing` | warning | An enabled catalog source's last sync has recorded an error for an hour | `lw_provider_last_error`, `lw_provider_enabled` |
| `LollyWorkProviderCredentialExpiring` | warning | 14 days or fewer remain before a source credential's expiry date, for an hour | `lw_provider_credential_expiry_days` |
| `LollyWorkNotificationsFailing` | warning | Every delivery on a channel in the last hour failed, for 15 minutes | `lw_notify_total` |
| `LollyWorkRateLimitBucketsHigh` | warning | The limiter has tracked over 80% of `rateLimit.maxBuckets` addresses for 15 minutes | `lw_rate_limit_buckets` |

Each alert carries a `severity` label, a summary and a description that says what to
check first. Some limits to know:

- `LollyWorkRenderFailures` cannot tell a failing render worker (502), a busy one
  (503 `RENDER_BUSY`) and a hooked tool on an instance without a worker (501) apart,
  because the metric records only the status class. The `error.code` of the response
  and the worker's log can.
- The two offload alerts fire at 90% of the thresholds at which Work raises its own
  console alert. The read alert uses the last day's rate rather than a 30-day
  increase, because Prometheus often keeps less than 30 days, so it needs a day of
  samples before it can fire.
- `LollyWorkRateLimitBucketsHigh` reads `rateLimit.maxBuckets` from the chart's
  `config` (inline or `--set-file`), or uses Work's default of 50,000.
- No alert ships for `lw_ofrep_evaluation_errors_total` or `lw_otlp_dropped_total`.
  If you use your own flag service or OpenTelemetry export, alert on their `rate()`
  staying above zero.

### Alert options

| Value | Effect |
|---|---|
| `metrics.prometheusRule.labels` | Labels on the `PrometheusRule`, for your Prometheus's `ruleSelector` |
| `metrics.prometheusRule.namespace` | Where the `PrometheusRule` goes, if not the release namespace |
| `metrics.prometheusRule.alertLabels` | Labels added to every alert, such as a team or a routing key |
| `metrics.prometheusRule.disabled` | Alert names to leave out. An unknown name stops the render |
| `metrics.prometheusRule.seriesSelector` | Label matchers for this release's series, described next |

### Selecting the series

Every expression selects this release's series with `job` and `namespace`. By default
they are the labels the chart's ServiceMonitor produces: `job` is the release's
Service name (`lolly-work` for a release called `lolly-work`) and `namespace` is the
release namespace. If your own scrape job collects Work's metrics, set
`metrics.prometheusRule.seriesSelector` to matchers for its series, for example
`job="lolly-work-prod"`.

### Checking the rules

The chart's tests render the rules and run `promtool check rules` on them, along with
the unit tests in `deploy/helm/files/prometheus-rules.test.yaml`, which cover every
alert. To check a rendered rule yourself, take `spec.groups` from the rendered
`PrometheusRule` into a file of its own and run `promtool check rules` on that file.

## Dashboard

The chart can also install a Grafana dashboard as a ConfigMap:

```yaml
metrics:
  grafanaDashboard:
    enabled: true
```

The ConfigMap carries the label `grafana_dashboard: "1"`, which the Grafana sidecar of
kube-prometheus-stack watches by default. Change `metrics.grafanaDashboard.labels` for
another sidecar, set `metrics.grafanaDashboard.namespace` if the sidecar watches one
namespace only, and use `metrics.grafanaDashboard.annotations` for a folder
(`grafana_folder: Lolly`). To import by hand, use
[`deploy/helm/dashboards/lolly-work.json`](https://github.com/lolly-tools/lolly-work/blob/main/deploy/helm/dashboards/lolly-work.json).

The dashboard has three variables, the Prometheus data source, the namespace and the
job, and five rows:

- **Health**: the audit chain, the share of readiness checks passed, uptime, memory,
  the SIEM backlog and the rate limiter's addresses;
- **Requests**: requests by status class, server errors by route, the busiest routes
  and rate-limited requests by surface;
- **Renders**: server renders by status class and the share that failed;
- **Files and delivery**: files stored and read by blob driver, response bytes by
  delivery class and configuration polls from Lolly apps;
- **Integrations**: a table of catalog sources and notification outcomes.

## Qualification

On 2026-10-27, Work 1.1.2 ran on K3s 1.35 with kube-prometheus-stack 92.14.0 and
Grafana 13.2.4. The ServiceMonitor scrape was up with the bearer token, Prometheus
loaded all twelve rules with no errors, every metric the rules read had a live series
(the failure-only series aside, which have their paired success series), and the
sidecar loaded the dashboard with data in each row.
