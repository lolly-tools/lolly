# What Lolly Work does today

Lolly Work is the server an organisation runs beside Lolly. People keep making things on
their own devices. Work adds the parts a team shares: one sign-in, shared projects, a
governed library of brand assets, server renders, links you can turn off, approvals and an
audit trail.

The current release is Work %work{version}, paired with Lolly %work{version}. The
[release notes](release-1-1-3.md) list the exact component versions. This page groups what
the release does into three lists: ready to use, worth checking against your own systems
first and not built yet.

::: figure work-status-capabilities
What Work %work{version} does, what to check on your own systems before you rely on it and what is not built.
:::

## Ready to use

- **Sign-in.** Your own OpenID Connect provider (one or several), GitHub, email and password,
  passkeys, a reverse proxy or a short code for the CLI and native apps. SCIM adds, changes
  and disables people from your directory. Back-channel logout from your provider ends the
  Work sessions that came from one provider session. See [Sign-in and sessions](identity.md).
- **People and access.** Roles that follow your directory groups, allow and deny grants,
  invitations with personal links, requests to join and requests for access. See
  [Roles and grants](permissions.md) and [Invite people and handle requests](invitations.md).
- **Team projects.** A role on each project, shared files and subfolders, comments, saved
  versions, live editing and a safe choice when two people save the same session. See
  [Team projects](team-projects.md).
- **A governed library.** Your design system, assets members submit with optional review,
  your own metadata fields, collections, versions, expiry and holds, plus 15 kinds of DAM and
  storage source. See [Catalog and content](catalog.md).
- **Rules for tools.** Lock, restrict or hide a tool's inputs per group. Govern feature flags
  and managed AI. Keep the whole policy as one document. See
  [Policy and governance](governance.md).
- **Renders and links.** Server renders in SVG and PNG, and JPG and PDF with a render worker.
  Durable render jobs and batches that recover after a restart. Signed links that expire and
  that you can turn off, including guest links. See [Share renders and links](sharing.md) and
  [Render jobs and batches](renders.md).
- **Delivery.** Send finished exports to S3-compatible storage, WebDAV, a signed HTTPS
  receiver, Brandfolder or Cloudinary, with an optional approval step. See
  [Organisation delivery destinations](delivery.md).
- **Approvals.** Ordered chains with `any`, quorum and `all` rules. Separation of duties.
  Review of a frozen set of source files. See [Approvals](approvals.md).
- **Records.** Content Credentials signing, a hash-chained audit log, telemetry dashboards and
  SIEM forwarding. See [Audit log](audit.md) and [Telemetry and dashboards](telemetry.md).
- **Agents.** Invite an MCP agent to one document or one project, under your own identity.
  See [Invite an agent to a document](document-agents.md).
- **Setup and packaging.** A six-step guided setup in the console, container images, Compose
  and a Helm chart with an optional render-worker tier. See
  [Configure your first Work instance](customer-setup.md) and [Install Lolly Work](install.md).

Try the hosted demo at lolly.work before you install. It renders for real: `GET
/render/<toolId>.<format>` serves live output. It holds sample data that does not persist and
runs apart from private workspaces, so use it for a trial, not as a production instance.

## Check on your own systems first

Work's tests use recorded fixtures for identity providers and DAMs. They check the code against
each vendor's published contract. They cannot show that your tenant matches that
contract, so run these checks before you rely on an integration.

- **Identity.** Check your registered callbacks, real owner groups, SCIM subject correlation,
  denied groups, revocation and source disable. [Customer setup](customer-setup.md) walks
  through each one and shows which integrations it has actually observed.
- **Sources.** Each [provider guide](providers/README.md) says what has been confirmed against
  a real tenant and what to verify on yours: field names, approval mapping and original-file
  checksums. [Check a source on your own tenant](providers/tenant-check.md) gives the steps.
- **Delivery.** The S3 adapter has been checked live against an S3-compatible host. WebDAV
  and signed HTTPS have wire tests and opt-in checks that have not yet run against a real
  receiver. Brandfolder and Cloudinary are fixture-tested.
- **Release artifacts.** Work %work{version} ships signed server and render-worker images for Linux
  amd64 and arm64, and its release record does not claim native arm64 runtime
  qualification. Choose and verify the image digests, client and worker versions, registry
  access and any `imagePullSecrets` before you install.
- **Your pack.** `inspect:pack` and Customer setup load your tools through the installed
  engine and report incompatible requirements, missing files and unsupported server formats.
  A passing engine-pin check does not establish that your clients and workers match.
- **Employee clients.** Work's audits, SBOM and notices cover its own deployment. Review the
  desktop and mobile binaries, their third-party notices and their distribution terms in the
  Lolly release you deliver.
- **Audit anchoring.** Work logs the audit head at boot and every hour. A database superuser
  can still bypass the append guard or truncate the tail, so collect heads in a store that
  your database administrators cannot change. See [Audit log](audit.md).
- **Shell and pack on Kubernetes.** Bring a built web shell on a volume you populate; brand
  packs are bring-your-own too (`pack.type` defaults to `none`). A wrong shell path fails at
  boot rather than serving an ungoverned app.

![The client fleet view: which shell and engine versions are talking to this deployment](shots/client-fleet.svg)

The console's Fleet view lists the Lolly versions that talk to your server, which helps
when you match clients to a release.

## Not built yet

- **Scoped service tokens.** A token has a role, an expiry, last-use metadata and
  revocation. Narrower scopes are not built.
- **Editable defaults.** An overlay stores `defaults` but does not apply them. Clients,
  collaboration, automation and server renders still need one agreed precedence.
- **Watermarks tied to approval.** `until-approved` is not linked to approval state, and
  binding an ordinary export to reviewed final bytes is not built. See
  [the enforce block](governance.md#the-enforce-block).
- **Two overlay keys.** `enforce.c2pa` and `enforce.escalation` are declared but the write
  paths do not accept them.
- **Ending one chosen session.** An admin can end all of a person's sessions, not one of
  them. See [Sign-in and sessions](identity.md#offboarding-disable-and-revocation).
- **An organisation-wide MCP endpoint.** Agents connect per document or per project.
- **Render dependency locking.** Receipts are partial, campaign reconciliation is not built,
  and a durable render resource cannot yet be delivered by reference. See
  [Render jobs and batches](renders.md#what-a-receipt-does-not-prove).
- **Delivery operations.** A replica-safe background claimant for queued deliveries,
  retention for staged retry bytes, and destination setup in the console or CLI.
- **Moving a project between instances.** Work previews what a move would involve; export
  and import are not built. See [Preview a project transfer](project-portability.md).
- **Several server nodes for live editing.** The live-editing server runs on one node.
- **High availability and central publication.** Trusted central pack publication, high
  availability and unattended delivery recovery have no selected deployment contract yet.
- **Direct SAML.** Connect a SAML-only provider through an OpenID Connect broker such as
  Keycloak.

## Release history

::: timeline
- <!--i:sparkle--> **1.1.2, 20 October 2026.** The current release, matched to Lolly 1.1.2. [Release notes](release-1-1-2.md).
- <!--i:box--> **1.1.1, 15 October 2026.** Matched to Lolly 1.1.1.
- <!--i:box--> **1.1.0, 12 October 2026.** Released together with Lolly web 1.1.0.
:::

::: details For contributors
A local `pnpm test` exercises only the memory store. CI runs the PostgreSQL leg with
`LW_TEST_DATABASE_URL` set.
:::
