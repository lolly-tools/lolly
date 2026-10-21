# Security and platform overview

Lolly helps people make files on their own devices. Lolly Work adds organisation sign-in, approved tools, rules and shared services. The security boundary depends on the workflow you choose.

[Explore the interactive overview](/#security-platform).

## Where the work happens

| Workflow | On the device | Across the network |
| --- | --- | --- |
| Work locally | Inputs, rendering and the export | No Work connection is needed for a prepared local workflow. Online features and new downloads are separate. |
| Apply organisation rules | The selected render and export | Sign-in, approved tools, policy requests and permitted usage labels. Syncing content is a separate choice. |
| Use shared services | The work a person chooses to keep locally | Selected inputs, shared sessions, collaboration changes or server-rendered outputs, according to the service used. |

Offline work needs the app, tool and all required assets or models to be available. New sign-ins and policy updates need a connection. Server rendering, collaboration and sync cannot complete offline. Do not assume that a policy change immediately recalls a local copy.

## What each part controls

**Lolly Work** checks identity and permissions and applies policy to governed server operations. Your organisation operates the service, its storage, secrets, monitoring and backups. Read [identity](identity.md), [permissions](permissions.md) and [governance](governance.md).

**The connection** carries the data each feature needs. Review identity, catalog access, telemetry, sync, collaboration, server rendering, AI features and providers separately. Local processing does not mean the whole deployment is unable to send data. Read [deployment](deployment.md), [sharing](sharing.md) and [telemetry](telemetry.md).

**The app and host bridge** connect portable tools to device capabilities. In the current Lolly web app, untrusted tool scripts run in strict Workers with a limited bridge and execution deadlines. If that isolation fails to start, the tool is refused. Verified built-in scripts can still run in the page. Review the catalog and signing keys, and assess the exact shell and release you deploy. A shared host API does not guarantee identical isolation on web, desktop and the command line.

**The engine** loads the tool and inputs and makes the output through the host app. Work also uses the engine for server rendering. Catalog signatures authenticate tool files; Content Credentials record an output's provenance. Neither proves arbitrary code safe or content true. Read [Content Credentials](c2pa.md) and [server rendering](sharing.md).

**Files and keys** have a lifecycle wherever they live. Device encryption is an endpoint responsibility. Browser storage is not a promise of disk encryption. Shared sessions, server records, stored files, downloaded copies and backups need their own retention decisions. Read [data lifecycle](data-lifecycle.md).

## What operators should check

- Test sign-in, group mapping, permission changes and account removal with the actual identity provider.
- Verify the release and catalog you distribute. Review added tools and their capabilities.
- Record the content and metadata sent by every enabled service. Telemetry settings do not govern session sync or server rendering.
- Collect audit heads in independently retained logs and verify receipt. A hash chain alone cannot prove that the newest records were not removed.
- Rehearse restoration of the database and stored files, as well as rollback.
- Agree retention and deletion rules for local, shared, downloaded and backed-up copies.

Use [audit](audit.md), [operations](operations.md) and [production evidence](production-readiness.md) for the detailed checks. A configured control is not the same as evidence that it works in your deployment.

## Scope of this explanation

The interactive examples explain the architecture; they do not inspect a live deployment or change its settings. The offline control is an explanation, not a network test.

The two repositories have different jobs: `lolly/` contains the engine, tools and apps; `lolly-work/` contains the organisation service and admin console. Work consumes a pinned engine. Check the deployed pin and shell release when applying this guide. For endpoint implementation details, use Lolly's `docs/threat-model.md`, `shells/web/src/lib/mount-runtime.ts` and `shells/web/src/bridge/hook-worker.ts`.
