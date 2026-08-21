# Security Policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately - do not open a public issue.

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

## Threat model and trust boundaries

Before reporting, it is worth checking whether the behaviour you found is
already a documented, accepted design choice.

- **[`docs/threat-model.md`](docs/threat-model.md)** is the reviewer's entry
  point: one row per trust boundary with its entry point, its enforcement point,
  the test that proves it and the accepted residual risk, plus a residual-risk
  register and a "what is not a boundary" section. Every claim cites a file and
  line you can read.
- **[`docs/parser-inventory.md`](docs/parser-inventory.md)** lists the
  file-format parsers that read attacker-controlled bytes, with their bounds and
  their fuzz coverage.

### Component to directory

The component names used in the prose above map to these paths. Each of the
lettered submodules also has its own repository under
[github.com/lolly-tools](https://github.com/lolly-tools), so a report can be
routed to the right one.

| Component | Directory | Repository |
|---|---|---|
| Engine (the platform-agnostic render core, all crypto and every format parser) | `engine/`, plus `schemas/` and `packages/core/` | this repository (`lolly`) |
| Web shell (the PWA, its capability bridge and its service worker) | `shells/web/` | `lolly-web` |
| Other shells | `shells/cli/`, `shells/tui/`, `shells/tauri-desktop/`, `shells/tauri-mobile/`, `shells/chrome-extension/` | `lolly-cli`, `lolly-tui`, `lolly-desktop`, `lolly-mobile`, `lolly-chrome-extension` |
| Community tools (tool data: manifest, template, `hooks.js`) | `community/` | `lolly-tools` |
| Brand packs (tool and asset content) | `brands/lolly-start/` (this repository), `brands/suse/` (private) | `suse-lolly` (private) |
| MCP endpoint, including its OAuth server and the public render route | `services/mcp/`, deployed via the generated `api/mcp/` bundle | `lolly-mcp-server` |
| Content Credentials certificate authority | `services/ca/`, deployed via the generated `api/ca/` bundle | `lolly-ca` |
| Documentation and the `/info` site | `docs/` | `lolly-docs` |

The repo-root `tools/` and `catalog/` directories are gitignored views
assembled from the packs above, not sources in their own right. A finding in a
tool belongs to the pack that owns it.

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

The project's standing security posture - on-device verification, the
cryptography and its test suite, SBOM and dependency-audit gates - is
documented in [Security & Verification](https://lolly.tools/info/security.html)
(`docs/security-verification.md` in this repository). The trust boundaries and
the accepted residual risks are in
[`docs/threat-model.md`](docs/threat-model.md).
