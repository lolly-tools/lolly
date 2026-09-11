# lolly-ca

Extracted from the [`lolly`](https://github.com/lolly-tools/lolly) monorepo and
consumed there as a git submodule at `services/ca/`.

Builds **within the monorepo** - depends on sibling workspace packages
(`@lolly/engine`) / relative paths that only exist in that layout.

Hosted deployments must configure `CA_RATE_LIMIT_REST_URL` and
`CA_RATE_LIMIT_REST_TOKEN` (or their shared `LOLLY_RATE_LIMIT_*` names) for a
Redis-compatible HTTPS REST endpoint. Authentication, enrolment, and email
dispatch then share cross-instance fixed-window limits; limiter outages fail
closed with 503 and exceeded budgets return 429. Raw IP and email values are
hashed locally before bucket keys leave the process. In-memory limiting is for
local development only; `CA_ALLOW_IN_MEMORY_RATE_LIMIT=1` is an explicit,
weaker escape hatch.

Forwarded client addresses are ignored unless `CA_TRUST_PROXY=1` and the direct
peer is an exact member of `CA_TRUSTED_PROXIES`. Keep both unset when the
platform already exposes the real peer address or the proxy boundary is not
known.
