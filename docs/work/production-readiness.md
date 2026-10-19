# Production evidence

Run the read-only checker from a source checkout with development dependencies
installed (`pnpm install --frozen-lockfile`). It checks the proposed internal OIDC
configuration and can probe an explicitly supplied staging origin. It does not
change the deployment or approve production.

```sh
pnpm run readiness -- --config /path/to/instance.json --out evidence.json
```

For Kubernetes, render the reviewed environment configuration with Helm first,
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
retention. Those checks remain `unverified` until the responsible teams review
the actual evidence. The proposed profile expects gated OIDC access, development
and proxy login disabled, usage telemetry/guest editing/nearby discovery off,
bounded sessions and explicitly reviewed retention. Other approved deployment
profiles need their own assessment of any differences.

Network probes use GET only, normal TLS validation, a timeout and a response-size
limit. They send no credentials and do not follow redirects. `/healthz` must
return Work JSON identifying gated access; `/readyz` must identify PostgreSQL.
Anonymous requests to the users, projects and audit routes must return 401/403.
A redirect to an identity provider is recorded as unverified; a 200 login page
does not pass as application readiness. For a disposable local rehearsal only,
`--allow-local-http` permits loopback HTTP.

Exit codes are **0** for passed checks, **1** for failed checks or input/output
errors, and **2** for incomplete evidence. External review requirements remain
unverified in this version, so a valid configuration normally exits 2. Do not
turn that into an automatic approval by ignoring the report. The report is an
evidence index for review, not a substitute for the change record.

Before production, attach exact release and scan results, business UAT, SUSE
authentication/lifecycle tests, central logging and alert receipts, restore and
rollback results, service ownership, approved data/AI scope and the required
functional reviews and CAB decision. See [operations](operations.md),
[identity](identity.md) and [deployment](deployment.md).
