# Check a deployment before production

Before people rely on an instance, run the read-only readiness checker against its
configuration, or against the Kubernetes manifests you are about to apply. It reports
what it can prove from those files and a staging address, and lists what it cannot see,
so you know which evidence is still yours to gather. It changes nothing and approves
nothing.

Run it from a source checkout with development dependencies installed
(`pnpm install --frozen-lockfile`). It checks the configuration against a strict,
sign-in gated OIDC profile:

```sh
pnpm run readiness -- --config /path/to/instance.json --out evidence.json
```

For Kubernetes, render the environment configuration with Helm first, then pass the
result, optionally with a staging address to probe. Use external secret references: rendered chart-managed
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
  the assessed configuration from a read-only mount and runs as non-root with a
  read-only root filesystem, no privilege escalation and all capabilities
  dropped. It uses `/healthz` and `/readyz` for its probes. Every ingress host
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

Exit code **0** means every check passed and **2** means the evidence is incomplete.
Failed checks and input or output errors exit **1**. The six manual items
below are always `unverified`, so a run with no failures exits 2. Do not turn
that into an automatic approval by ignoring the report. The report is an index
of evidence, not a sign-off.

The report always lists six manual items: identity, release, security,
operations and change, plus a combined privacy and AI item. They were written for the maintainers'
own rollout, and their wording refers to checks and records from that
environment. Use your own checklist in their place. The report still lists
them, and the checker verifies none of them. Useful evidence includes:

- the exact release and its scan results;
- sign-in and offboarding tests with test accounts;
- receipts from your log and alert systems;
- restore and rollback results.

See [operations](operations.md), [identity](identity.md) and
[deployment](deployment.md).
