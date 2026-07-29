# Security Policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately — do not open a public issue.

- **Email:** [fitzy+security@suse.com](mailto:fitzy+security@suse.com)
- **GitHub:** private vulnerability reporting on the relevant
  [lolly-tools](https://github.com/lolly-tools) repository
  (Security → "Report a vulnerability")

Include what you can: affected component (web shell, engine, CLI, an `api/`
endpoint, a specific tool), reproduction steps, and impact as you understand
it. We will acknowledge your report, keep you informed while we investigate,
and credit you in the fix notes unless you prefer otherwise. We practise
coordinated disclosure: we ask that you give us the opportunity to remediate
before publishing details.

## Safe harbour

Good-faith security research against your own Lolly instance or data is
welcome. We will not pursue action against researchers who make a good-faith
effort to respect user privacy, avoid data destruction and service disruption,
and report through the channel above. Do not test against other people's data
or accounts.

## Scope

- This repository and the `lolly-tools` organisation repositories (engine,
  shells, services, community tools).
- The reference deployments at `lolly.tools` and `lolly.art`, including the
  optional server components (`/api/mcp`, `/api/ca`, the public
  `/tool/<id>.<ext>` render route).

Self-hosted instances are operated by their operators; server-side issues in a
self-hosted deployment should go to that operator, engine/app issues to us.

## What we ship

The project's standing security posture — on-device verification, the
cryptography and its test suite, SBOM and dependency-audit gates — is
documented in [Security & Verification](https://lolly.tools/info/security.html)
(`docs/security-verification.md` in this repository).
