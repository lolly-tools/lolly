# Lolly Work security overview

Lolly helps people make files on their own devices. Lolly Work adds organisation sign-in, approved tools, rules and shared services. The security boundary depends on the workflow a person uses, so this page follows the work: what stays on the device, what crosses the network and what each part of the deployment controls.

The [lolly.work](https://lolly.work) demo's landing page shows an interactive version of this overview. It explains the architecture; it does not inspect or change a live deployment, and its offline switch is an explanation rather than a network test.

## Where the work happens

| Workflow | On the device | Across the network |
| --- | --- | --- |
| Work locally | Inputs, rendering and the export | No Work connection is needed for a prepared local workflow. Online features and new downloads are separate. |
| Apply organisation rules | The selected render and export | Sign-in, approved tools, policy requests and permitted usage labels. Syncing content is a separate choice. |
| Use shared services | The work a person chooses to keep locally | Selected inputs, shared sessions, collaboration changes or server-rendered outputs, according to the service used. |

Offline work needs the app, the tool and every asset or model it uses to be on the device already. New sign-ins and policy updates need a connection, and server rendering, collaboration and sync cannot complete offline. A policy change does not necessarily recall a copy already on a device.

## What each part controls

**Lolly Work** checks identity and permissions and applies policy to the server operations it governs. Your organisation operates the service, its storage, secrets, monitoring and backups. Read [identity](identity.md), [permissions](permissions.md) and [governance](governance.md).

**The connection** carries the data each feature needs. Review identity, catalog access, telemetry, sync, collaboration, server rendering, AI features and providers one at a time: local processing does not mean the whole deployment sends nothing. Read [deployment](deployment.md), [sharing](sharing.md) and [telemetry](telemetry.md).

**The app and host bridge** connect portable tools to device features. In the current Lolly web app, untrusted tool scripts run in strict Workers with a limited bridge and execution deadlines, and if that isolation fails to start, the tool is refused. Verified built-in scripts can still run in the page. Review the catalog and its signing keys, and assess the exact shell and release you deploy, because a shared host API does not guarantee the same isolation on the web, the desktop and the command line.

**The engine** loads the tool and its inputs and makes the output through the host app, and Work also uses it for server rendering. Catalog signatures authenticate tool files, and Content Credentials record an output's provenance. Neither proves code safe or content true. Read [Content Credentials](c2pa.md) and [server rendering](sharing.md).

**Files and keys** have a lifecycle wherever they live. Device encryption is the endpoint's job, and browser storage is not a promise of disk encryption. Shared sessions, server records, stored files, downloaded copies and backups each need their own retention decision. Read [data lifecycle](data-lifecycle.md).

## What operators should check

::: check Before you rely on a deployment
- Test sign-in, group mapping, permission changes and account removal with the real identity provider.
- Verify the release and catalog you distribute, and review any tools you add and what they can do.
- Record the content and details every enabled service sends. Telemetry settings do not govern session sync or server rendering.
- Collect audit heads in independently kept logs and confirm they arrive. A hash chain alone cannot prove that the newest records were not removed.
- Rehearse restoring the database and stored files, and rolling back.
- Agree retention and deletion rules for local, shared, downloaded and backed-up copies.
:::

[Audit](audit.md), [operations](operations.md) and [production evidence](production-readiness.md) give the detailed checks. A configured control is not evidence that the control works in your deployment.

Work runs on a pinned Lolly engine, so check the engine version your instance pins and the shell release you ship when you apply this page. For the app and engine boundaries in detail, read Lolly's [Threat Model & Trust Boundaries](https://lolly.tools/info/trust/threat-model.html).
