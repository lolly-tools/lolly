# Security Policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately - do not open a public issue.

- **Email:** [fitzy+security@suse.com](mailto:fitzy+security@suse.com)
- **GitHub:** private vulnerability reporting on
  [lolly-tools/lolly](https://github.com/lolly-tools/lolly)
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
  their fuzz coverage. Its table is generated from
  `security/parser-assurance.json`; use `pnpm run build:parser-inventory` after an
  intentional registry change and `pnpm run check:parser-inventory` to detect drift.

### Component to directory

The component names used in the prose above map to these paths. Every one of
them lives in this repository, so one report reaches all of it. The single
exception is the private SUSE brand pack, a submodule with its own repository.

| Component | Directory | Repository |
|---|---|---|
| Engine (the platform-agnostic render core, all crypto and every format parser) | `engine/`, plus `schemas/` and `packages/core/` | this repository (`lolly`) |
| Web shell (the PWA, its capability bridge and its service worker) | `shells/web/` | this repository |
| Other shells | `shells/cli/`, `shells/tui/`, `shells/tauri-desktop/`, `shells/tauri-mobile/`, `shells/chrome-extension/` | this repository |
| Community tools (tool data: manifest, template, `hooks.js`) | `community/` | this repository |
| Brand packs (tool and asset content) | `brands/lolly-start/` (this repository), `brands/suse/` (private) | `suse-lolly` (private submodule) |
| MCP endpoint, including its OAuth server and the public render route | `services/mcp/`, deployed via the generated `api/mcp/` bundle | this repository |
| Content Credentials certificate authority | `services/ca/`, deployed via the generated `api/ca/` bundle | this repository |
| Documentation and the `/info` site | `docs/` | this repository |

A checkout has no repo-root `tools/` or `catalog/` directory: those two paths
are resolved out of the packs above by
`packages/node-shell/src/content-roots.ts`, and only a build that serves them
over HTTP writes them out. A finding in a tool belongs to the pack that owns
it.

## Safe harbour

Good-faith security research against your own Lolly instance or data is
welcome. We will not pursue action against researchers who make a good-faith
effort to respect user privacy, avoid data destruction and service disruption,
and report through the channel above. Do not test against other people's data
or accounts.

## Scope

- This repository (engine, shells, services, community tools) and the private
  `suse-lolly` brand pack.
- The reference deployment at `lolly.tools`, including the
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

## Maintainer security checks

`pnpm run audit:all` inventories and audits every authoritative npm and Cargo
lockfile. `pnpm run secrets:scan` scans the parent repository's complete tracked
history with redacted output; install the pinned Gitleaks 8.29.1 binary and set
`GITLEAKS_BIN` if it is not on `PATH`. For a pre-commit check, run
`pnpm run secrets:scan:staged`.

### Dependency audit exceptions

A high or critical advisory blocks CI. An advisory that cannot be fixed yet may be
held back only with the maintainer's approval, as an `advisoryExceptions` entry on
its Cargo root in `security/dependency-roots.json`. Each entry lists its RustSec
ids, the vulnerable crate, the crate that pulls it in, the versions that carry the
fix, who approved it, a written justification and the upstream links.
`pnpm run audit:all` passes those ids to `cargo audit --ignore` for that one
lockfile and no other. Before any audit, and in `audit:all --check`, the script
fails when the lockfile shows the hold has outlived its fix: no vulnerable copy is
left, another crate starts pulling one in, or the parent crate's fixed release
resolves. The exception then has to be removed in the same change.

No exception is held today. The last one, approved by Andy on 2026-10-17, held
RUSTSEC-2026-0367, RUSTSEC-2026-0368 and RUSTSEC-2026-0369 for `zip` 4.6.1, which
reached `shells/tauri-desktop/src-tauri/Cargo.lock` only through
`tauri-plugin-updater`. It was removed on 2026-11-02, when `tauri-plugin-updater`
2.14.1 was published and resolved `zip` 9.2.2. That release also fixes
RUSTSEC-2026-0429, a later `zip` advisory.

The ignored/untracked checkout is deliberately not read by either command.
Auditing it is an explicit opt-in because it may contain personal credentials:
`pnpm run secrets:scan:checkout --confirm-untracked`. Findings are redacted,
but any detected credential must still be rotated rather than merely allowlisted.
Device-local operational files belong outside this checkout and must meet the
ownership, permission and no-symlink rules in
[`security/local-credential-storage.md`](security/local-credential-storage.md).

`pnpm run build:web` is an unsigned development/preview build and labels itself
as such. Deployments must use `pnpm run build:web:release`; it requires
`LOLLY_CATALOG_SIGNING_KEY` and the matching public
`VITE_CATALOG_PUBLIC_KEY_JWK`, signs the active catalog, and refuses to build if
the verification pin is missing, private, malformed, or mismatched.
