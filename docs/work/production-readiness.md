# Production evidence

Run the read-only checker from a source checkout with development dependencies
installed (`pnpm install --frozen-lockfile`). It checks an instance configuration
against a strict, sign-in gated OIDC profile and can probe an explicitly supplied
staging origin. It does not change the deployment or approve production.

```sh
pnpm run readiness -- --config /path/to/instance.json --out evidence.json
```

For Kubernetes, render the environment configuration with Helm first,
then supply the result. Use external secret references: rendered chart-managed
Secret resources can contain credentials and are refused by this evidence profile.

```sh
pnpm run readiness -- --manifests /path/to/rendered.yaml \
  --base-url https://staging.example.com --out evidence.json
```

The output path must be new; reports are created with owner-only permissions.
Reports contain the input hash and selected check results, without raw config,
tokens, cookies, response bodies or parser exception messages. Treat the input
and evidence as internal operational material even when the checker finds no
recognised secret field. It is not a general secret scanner.

The checker distinguishes configuration from proof. A configured OIDC issuer
does not prove MFA or authorised membership; a SIEM URL does not prove receipt or
retention. Those checks stay `unverified` because the checker cannot see that
evidence. The checks it runs automatically are:

- **Configuration.** Recognised credential fields and private keys appear only
  as references. The application parser accepts the file. The base URL uses
  HTTPS, and every OIDC issuer uses HTTPS with a client ID. Access is gated. Development and proxy
  sign-in are off. Sessions last 24 hours at most. Usage telemetry, managed AI,
  guest editing and nearby discovery are off. In-process hook rendering is off.
  Audit-head logging is on.
- **When configured.** Audit retention of 180 days or more, a finite telemetry
  retention, an HTTPS SIEM endpoint and a submission scanner that rejects
  unanswered scans and runs locally or over HTTPS. A missing setting, or audit retention under 180 days, stays
  `unverified` rather than failing.
- **Rendered manifests.** Every image is pinned by SHA-256 digest. There are no
  Secret resources and no inline credential values. Exactly one Work server reads
  the assessed configuration from a read-only mount, runs as non-root with a
  read-only root filesystem, no privilege escalation and all capabilities
  dropped, and uses `/healthz` and `/readyz` for its probes. Every ingress host
  has TLS; with no Ingress in the manifests, TLS stays `unverified`. Database
  durability always stays `unverified`.

A deployment that allows longer sessions, or turns on telemetry, managed AI,
guest editing, nearby discovery or in-process hook rendering by choice, fails
that check. Judge each difference for your own deployment.

Network probes use GET only, normal TLS validation, a timeout and a response-size
limit. They send no credentials and do not follow redirects. `/healthz` must
return Work JSON identifying gated access; `/readyz` must identify PostgreSQL.
Anonymous requests to the users, projects and audit routes must return 401/403.
A redirect to an identity provider is recorded as unverified; a 200 login page
does not pass as application readiness. For a disposable local rehearsal only,
`--allow-local-http` permits loopback HTTP.

Exit codes are **0** when every check passes, **1** for failed checks or
input/output errors, and **2** for incomplete evidence. The six manual items
below are always `unverified`, so a run with no failures exits 2. Do not turn
that into an automatic approval by ignoring the report. The report is an index
of evidence, not a sign-off.

The report always lists six manual items: identity, release, security,
operations, privacy and AI, and change. They were written for the maintainers'
own rollout, and their wording refers to checks and records from that
environment. Use your own checklist in their place. The report still lists
them, and the checker verifies none of them. Useful evidence includes the
exact release and scan results, sign-in and offboarding tests with test
accounts, log and alert receipts, and restore and rollback results. See
[operations](operations.md), [identity](identity.md) and
[deployment](deployment.md).
