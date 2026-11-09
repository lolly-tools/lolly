# Release 1.2.0: Lolly and Lolly Work

<a id="release-1-2-0-lolly-and-work"></a>

This is the current release. Lolly Work 1.2.0 pairs the Lolly Work server and render worker with
[Lolly 1.2.0](https://github.com/lolly-tools/lolly/releases/tag/v1.2.0), built from
Lolly source `b2128b260525e82cd6d7d29647eef915354ffc8f`. It is published as
[Lolly Work v1.2.0](https://github.com/lolly-tools/lolly-work/releases/tag/v1.2.0).
Installation and production acceptance are tracked separately.

Start with the tagged [installation guide](https://github.com/lolly-tools/lolly-work/blob/v1.2.0/docs/install.md),
[deployment options](https://github.com/lolly-tools/lolly-work/blob/v1.2.0/docs/deployment.md)
and [documentation index](https://github.com/lolly-tools/lolly-work/blob/v1.2.0/docs/README.md).

1.2.0 adds partner programmes. Resellers, distributors and other partners each get their own
tools, templates, files, company details and agent tokens. Files reach them by the licence each
file records, and a partnership can end on a set date and be reopened within 30 days. Service
tokens gain scopes and limits, an organisation MCP endpoint serves them, a reviewer approves the
exact exported file, and the durable render routes catch up with the older job API. Most of this
waits until an administrator sets it up. The changes that apply on upgrade are listed under
**On upgrade** below.

## Matching components

| Component | Version or source |
|---|---|
| Lolly product version | 1.2.0 |
| Lolly Work application | 1.2.0 |
| Render worker and admission adapter | 1.2.0 |
| Lolly Work Helm chart | 1.2.0, with appVersion 1.2.0 |
| Lolly source | `b2128b260525e82cd6d7d29647eef915354ffc8f` |
| Engine | 1.343.0 |
| Tool-author core | 1.8.0 |
| Lolly web archive for YunoHost | `lolly-web-1.2.0-ynh1.tar.gz`, 808,658,284 bytes, SHA-256 `3a324eef05128d32c6154ab88e360c40a8235ee181c3b49abe4ef5b556d1ac0f` |

Engine and core versions describe their own contracts and are not reset to the
product version. `engine-pin.json` and `content-resolver-pin.json` record the
Lolly source above. The maintained producers generated both.

Lolly Work 1.1.3 carried engine 1.285.0 and core 1.5.0. From engine 1.343.0, Lolly Work uses
the approval record in Content Credentials (including the record for a template's variants),
the design system and colourway keys of the Lolly record, the licence reader and the
`.lolly` credits text, the intent checks for templates, the Design compiler that rebuilds a
Share with rules file, and the DESIGN.md writer. Core 1.8.0 carries the `partner-kit-v1` format.

## What Lolly 1.2.0 needs from this release

| Lolly 1.2.0 feature | What Lolly Work 1.2.0 adds |
|---|---|
| Approval of the file itself | The `export-review` approval subject: the exact exported file, frozen with the request and released by `GET /api/v1/approvals/:id/artifact` |
| "Until approved" shows PREVIEW until an approved request matches | Server enforcement of `enforce.watermark: until-approved`, and `POST /api/v1/approvals/match` for the export bar |
| Brand managers edit colours, colour roles and the brand page address with no rebuild | `/api/v1/brand/edits`, the `brand.edit` action and the `brand-manager` role |
| Publish a brand page to a Lolly Work instance | `POST /api/v1/brand-pages` and public pages at `/brand/<slug>/`, off unless `brandPages.enabled` |
| Workspace templates on the home shelf and in the Start chooser | Template entries in each caller's feed, with version, editable inputs, retirement, replacement and company bindings |
| A partner's logo and details already in place, the company card, and a home that keeps to what is theirs | org-config `partner` and `programmeScoped`, and per-tool `defaults`, `bindings` and locked values |
| View as partner | `POST /api/v1/programmes/:id/view-as`, the `x-lw-view-as` header and `POST /api/v1/view-as/end` |
| Partner kits in Design | org-config `partner.company.kit` and `GET /api/v1/me/company/kit` |
| A tool turned off for a group stays off, and an export rule for one tool holds | `tool.use` grants decide the tool feed and `/tools/*`, and org-config answers `tools[<id>].can` per tool |
| Links whose recipients can change the inputs | `"open": true` in a tool link's signed target |
| A release-built web app lists tools when the feed holds workspace files | Instance asset checksums served in SRI form |

**The API detail behind each feature**

- **The exact file.** An approval request of subject `export-review` carries the exported
  bytes, sent by the parts protocol in the new `approval-artifact` upload scope, which
  `policy.approvalArtifacts` governs rather than `policy.uploads`. Creating the request checks
  the bytes and freezes them with their SHA-256, size, name, format, media type, tool id and
  tool version. `GET /api/v1/approvals/:id/artifact` serves them inert and audited: before a
  decision to eligible reviewers and people who acted, to the requester only once approved, and
  never after a rejection or withdrawal. Approving needs the subject's fingerprint
  (`409 ARTIFACT_SUBJECT_CHANGED`) and a token that comes only with the bytes
  (`409 ARTIFACT_NOT_LOADED`), so nobody approves from the JSON alone. Inbox messages about such
  a request carry `data: { kind: 'export-review', approvalId }`.
- **The approval in the approved file.** When the requester leaves the box ticked,
  `policy.approvalArtifacts.recordInCredentials` is on (the default), the server has a signing
  identity and the engine can write the record, the approved download is the reviewed bytes with
  a signed Content Credentials update that records the approval. In every other case it is the
  reviewed bytes untouched, and the request gives the reason. `?file=reviewed` and
  `lw approvals artifact --reviewed` still give the reviewed bytes.
- **Until approved.** A server render of a tool with `enforce.watermark: until-approved`
  carries the PREVIEW pattern unless an approved `export-review` matches its tool id, tool
  version, inputs digest and format. The app reports the inputs; the server works out the digest
  with the render path's own steps and keeps no values. `POST /api/v1/approvals/match` (a
  person's session only) answers `none`, `in_review`, `approved`, `rejected` or `changed` for a
  tool, a format and a URL-mode query, and sends no bytes or digest. org-config advertises it as
  `approvals.exportReview.match`, and discovery as `approvals.exportReviewMatch`. Server
  renders, share links and durable outputs say `x-lolly-watermark: Marked until approved` or
  `Approved, not marked`, and those responses are `private, no-store`.
- **Brand edits.** Routes under `/api/v1/brand/edits`: state and history (`GET`), the
  document, preview, send (`POST`), rollback, keep and settings. A sent document may differ from
  the mounted one only in colours, colourways, colour roles and their bindings, and the brand
  page address; anything else is refused by name. Work serves the edit from an immutable
  revision over the mounted pack, so the catalogue, its signature, server renders, the Chromium
  worker and rule checks all read the edit. Approval before an edit goes live and the
  keep-or-roll-back question after a new image are both off by default, and changing either needs
  `policy.edit`. A connect pack is derived only when this instance's key signed the kept
  pack.
- **Brand pages.** With `brandPages.enabled`, `POST /api/v1/brand-pages` takes a page folder as
  a ZIP through the parts upload (scope `brand-page`), checks every file against `brand.json`
  and its digest, and keeps immutable revisions with one current revision per address. Pages are
  served at `/brand/<slug>/` under a CSP that runs no script, listed at
  `/.well-known/lolly-brand.json` and `/api/v1/brand-pages/public`, and read by agents at
  `POST /brand/<slug>/mcp`. Publishing needs the new `brand.page.publish` action (admin), can
  wait on `brandPages.approvalChain`, and is closed to scoped tokens. The parser accepts the
  `logos` list, `fonts/<family>-licence.txt` and `colourRoles` that Lolly 1.2.0
  writes.
- **Templates in the feed.** A template published to a programme or company appears in its
  people's feed with `meta.version`, `meta.editable`, `meta.retired`, `meta.replacedBy`,
  `meta.bindings` and, where set, `meta.intents`. It never gives a rule's name or a reason. A Share
  with rules file published the same way is served as a tool at `/tools/<id>/*`. Work rebuilds
  that tool from the file's data with the pinned Design compiler, and never stores, serves or
  runs the file's `hooks.js`. Where a programme keeps a tool to its templates, the tool index
  marks the tool `listed: false` and `templatesOnly: true`.
- **The partner in org-config.** For a programme member, `GET /api/v1/org-config` carries
  `programmeScoped: true` and `partner: { company, programme }`: the company's id, name,
  profile revision, logos, website, contact, address, currency and tax note, plus
  `partner.accessEndsAt` and `partner.accessEndsThrough` when an end is due. A tool with company
  bindings gets `tools[<id>].defaults` and `tools[<id>].bindings`, and a bound input the rules
  lock arrives as `access: { level: 'locked', value }`. No input in org-config carries a rule's
  name or reason.
- **View as partner.** `POST /api/v1/programmes/:id/view-as`, with an optional `company`,
  returns a one-hour token bound to the admin's session. The app sends it from one tab in
  `x-lw-view-as`. Only a partner's reads answer, as the partner and limited to what the admin may
  also see: org-config (with `viewingAs` and every `can` bit false), the inbox, `/catalog/*`,
  `/tools/*`, catalogue browse, the AI policy and the company profile. Writes and other reads
  answer `403 VIEWING_AS`, another session `403 VIEWING_AS_MISMATCH`, and an ended view
  `403 VIEWING_AS_ENDED`. `POST /api/v1/view-as/end` ends the view for good.
- **Partner kits.** org-config carries `partner.company.kit: { id, revision, label }` for the
  company's members, and `GET /api/v1/me/company/kit` returns the kit.
- **Tool grants.** A `tool.use` deny now hides a tool from the tool feed, its signature and
  sidecars, tool art, share cards and `/tools/*`, as it already did from Preview, server renders
  and the organisation MCP. An allow outside the overlay's visibility clause shows the tool.
  org-config adds `tools[<id>].can` where an `export.download` or `export.request` grant for one
  tool gives a different answer from the deployment-wide bit. Older apps read only the
  deployment-wide bit.
- **Open links.** A `share`, `embed` or `download` link to a tool minted with `"open": true` in
  its target lets recipients add the tool's URL params, each replacing the baked value, and each
  set renders a new asset with its own `ETag`. Locked, hidden and disallowed inputs still answer
  422 (`INPUT_LOCKED`, `INPUT_HIDDEN`, `INPUT_NOT_ALLOWED`). The flag is signed into the target,
  opening a link needs `export.server` for the tool as well as `link.create`, and guest, asset
  and collection links cannot be open. `lw links create <toolId> … --open` mints
  one.
- **SRI checksums.** The served asset index gives instance assets (`inst/*`) their checksum as
  `sha256-<base64>`, the form `schemas/asset.schema.json` states, instead of the blob store's
  hex. A release web app refused a whole index over one hex row. Stored records and blob ETags
  are unchanged.
- **Ask an agent, ready for the desktop apps.** The AI policy accepts the `agents` capability,
  off by default and matched exactly, for the desktop apps' Ask an agent in their next build.

## Other changes since 1.1.3

**Partner programmes**

- **Programmes.** An administrator, or anyone granted `programme.manage`, creates a programme
  for each kind of partner. It wraps the reserved local group `programme-<id>`. Its people see
  only the tools a `tool.use` allow grant gives that group, the design system's essentials, and
  the collections, assets and provider folders shared with the programme. "Everyone" no longer includes
  them, and `*` in a group list now means everyone internal. Joining adds a `partner` marker
  that stays after they leave. Preview shows what each group gets.
- **Input rules for partners.** Within one programme, a rule for the person's company overrides
  the programme's rule in either order. Across programmes the stricter result wins, and a partner
  rule beats a generic one. Everyone else keeps the overlay's first-match order. Preview tells an
  admin which rule decided, with its name and reason.
- **People and companies.** Companies sit inside a programme as `company-<id>` groups. People
  are added from pasted text or a CSV (email, name, company, end date), previewed row by row and
  applied with `apply: true`; the same list twice changes nothing, and a row naming an admin or
  owner is refused. Memberships can carry an end date, which a sweep applies every
  minute.
- **Partner domains.** A partner's domain can feed a programme, with an optional company and end
  date. Proof is a DNS TXT record, `_lolly-work.<domain> TXT "lw-verify=<token>"`, or an
  admin's audited say-so. Anyone who signs in with a provider-verified address at that exact
  domain joins. Public mail domains, shared suffixes such as `co.uk` and the workspace's own
  domains are refused. Staff accounts already here are never moved unless an admin chooses
  `moveStaff`. A domain whose record disappears pauses.
- **Provider folders.** A rule gives one folder of a connected provider, and everything below
  the folder, to a programme or one company until an optional end date. Drivers now report a
  folder per asset: S3 and Dropbox the full key prefix, WebDAV the directory, OneDrive and
  SharePoint the path, Brandfolder the section. Google Drive gains an opt-in recursive walk
  (`recursive`, `maxDepth` default 4, `maxFolders` default 500). A rule must name a folder; the
  whole provider takes `whole: true`.
- **Templates.** A brand team publishes a catalogue template or a Share with rules file to a
  programme or company, chooses what partners may change, versions the template and retires it
  with an optional replacement. A render naming `template=inst/<id>` starts from the template's
  values and answers `422 INPUT_LOCKED` for a fixed input, `404 TEMPLATE_NOT_FOUND` outside the
  caller's feed, `422 TEMPLATE_TOOL_MISMATCH` for another tool and `410 TEMPLATE_RETIRED` with
  `replacedBy` once retired. A rules file that loads anything from outside itself, is damaged,
  comes from another tool's session, reuses an id or is not newer is refused at upload. The
  templates-only switch, per programme and tool and off by default, makes a render that names
  none of their templates answer `422 TEMPLATE_REQUIRED`. Publishing records the workspace's
  owner-published mark on its own work unless `ownerMark: false`.
- **Company profiles and values.** Each company gets logos for light and dark surfaces, an
  optional mark, a website, contact, address, currency and tax note, kept as numbered revisions.
  A logo is SVG up to 512 KB or PNG up to 2 MB and at least 400 px on its long side. SVGs are
  cleaned with the web app's own DOMPurify profile, and active content or references to other
  files are refused; low contrast and opaque backgrounds are warnings only. Templates and tool
  overlays bind inputs to company fields, and one resolver fills them for renders, org-config,
  Preview and the agents' schema. Editing by a company's own contacts is off by default, with an
  optional approval chain.
- **Partner kits.** One kit per company in the `partner-kit-v1` format: logos pinned by
  version, colours, and rules such as clear space, minimum size and treatments, which a person
  types. An import from a tokens file, a `.lolly` share or the company's SVG logos stores nothing
  until saved. Kit changes can wait for approval (`settings.kitApprovalChain`, off by default),
  ending a partnership retires the kit, and Reopen restores the retired
  revision.
- **Licences decide what reaches partners.** With `policy.catalog.partnerRights: gate`, a file
  reaches a partner, or anyone holding a link, only when its recorded licence lets the bytes
  travel, the brand team marked the file as its own, the file is exempt, or an admin shared it
  anyway with that audience. Exempt types are `tokens`, `font`, `palette`, `template`,
  `rules-tool`, `user-tool` and `skill`, plus a company's own files for that company. A server
  render or compile that needs a held file answers `422 ASSET_HELD`. Marks cover one asset, a
  provider folder, a provider or a pack id prefix, and never reach a file that records its own
  licence. A share-anyway choice retires when the file, its licence record or the rules change.
  Staff receive what they did before. `GET /api/v1/programmes/:id/rights-report` and
  `lw programmes rights-report` show what the gate holds or would hold.
- **Credits.** Every collection ZIP a link serves starts with `CREDITS.txt` and `credits.json`,
  listing only the files in that ZIP. The collection link page shows one credit line where a
  licence asks for a credit.
- **Ending a partnership.** Ending a programme or company marks it ended and keeps one receipt
  per exit. It offboards the people whose access ends, revokes the agent tokens placed there,
  retires templates published only to the selection, ends its folder rules and withdraws its
  share-anyway choices. An end can be scheduled for the end of a UTC day, and people are told 14
  days and 1 day before, in the inbox and by email where `notify.people.email` is set up. Within
  30 days, Reopen brings back the accounts, memberships, templates, folders and projects the
  receipt lists; links, tokens, sessions and share-anyway choices stay
  ended.
- **Partner scope on every route.** A partner's reads follow their own served feed: instance and
  submission bytes, asset records, pack files no asset owns, `cms://` sources, live search,
  submit duplicates, collections, lifecycle, `/catalog/ext/...` and brand profiles. Anything
  outside the feed answers a plain 404 "not available", and `/connect/pack.lolly` answers 403.
  A programme-scoped person, token or view can only hold the actions in `PARTNER_ACTIONS`,
  whatever a role default or grant says; `group.create` and `delivery.create` are among those
  withheld. Staff are unchanged.
- **Partner agents.** A programme's manager mints, limits and revokes tokens for a partner's
  agent. Such a token has the `automation` role, scopes `render` and `catalog.read` by default
  with `documents`, `files` and `approvals.request` optional, and a 90-day lifetime by default
  (1 to 365). Limits default to 120 calls a minute and 2,000 renders a UTC day with no monthly
  cap, and can be set per instance, programme or token. Usage counts per token, company and
  programme, with a CSV download, never hold an input value, prompt, title or file
  name.
- **Console.** Partner programmes pages with Templates, People, Domains, Provider folders,
  Licences, Agent tokens, What agents did and End cards, and a page per company with Details,
  Logos, Contacts, Partner kit, Agent tokens and End. Preview draws each template exactly as a
  chosen company receives the template.
- **CLI.** `lw programmes`, `lw companies` (with `profile` and `kit`), `lw templates`,
  `lw people import|exit|exits|reopen`, `lw domains`, `lw folders` and `lw catalog rights`, and
  programme placement, limits and usage on `lw tokens`.

**Service tokens and agents**

- **Scopes.** A service token can name what it may reach: `render`, `documents`, `files`,
  `delivery`, `catalog.read`, `audit.read` and the opt-in `approvals.request`.
  Scopes and an optional tools list are fixed at mint. A route missing from the scope table
  answers `403 TOKEN_SCOPE`, and scopes only narrow what the token's role allows. The new
  token-only `automation` role holds `tool.use`, `export.server`, `delivery.create`,
  `catalog.read` and `audit.export`, and can only be minted with scopes. A token with no scopes
  behaves as before.
- **Organisation MCP.** `POST /api/v1/mcp` serves service tokens with `list_tools`,
  `describe_tool`, `validate`, `render_tool`, `get_render`, `get_render_output`,
  `cancel_render`, `submit_batch`, `get_batch`, `search_assets`, `list_destinations`,
  `deliver_render` and `resolve_intent`, plus `request_approval`, `get_approval` and
  `withdraw_approval` for a token holding `approvals.request`. Each call runs through the router
  with the caller's own token, so scopes, role, tool list, visibility and input policy apply as
  over HTTP, and a tool the token cannot reach is not listed. A person's session gets 401. A
  person's agent invitation stays on `/api/workspace/mcp`.
- **Brand context for agents.** MCP resources `lolly-work://me`, `lolly-work://brand` and the
  brand's DESIGN.md, tokens, AGENTS.md, checks and skills, and for a partner token its company,
  logos, templates and kit. The same reads are at `GET /api/v1/context/*`, for service tokens
  only. Brand page files reach an agent only while the page is public.
- **Intents.** `POST /api/v1/intents/resolve` (scope `render`) says which tool the caller can
  render a piece with on each surface, with the input values and what is missing. The pinned
  engine decides with no model, and the answer leaves out tools and inputs the caller cannot
  use. Company values count as met, and published templates with purposes are candidates.
  Nothing is rendered, kept or audited. `lw intent resolve` exits 0 when every surface is ready
  and 4 otherwise.
- **Agents asking for review.** A token holding `approvals.request` files an export review on
  one of its own finished renders; the reviewed file is that render's output, checked against its
  receipt. A partner token uses the tool's chain or one its programme lists (`approvalChains`),
  else `403 CHAIN_NOT_FOR_PROGRAMME`. A delivery to a destination with a chain then waits for a
  person instead of answering `403 HUMAN_APPROVAL_REQUIRED`. Deciding stays with
  people.
- **One approval for a template's variants.** `enforce.approvalCovers: template-variants` on a
  tool overlay (default `file`) lets one approval of a template version cover every render from
  that version, whatever partners put in its open inputs. A new version, a change to what is open
  or a different fixed value needs a new approval. Such renders record `tools.lolly.approval` in
  their Content Credentials with `covers: 'template'`, the template id and version, and the
  example file's digest.

**Renders**

- **Durable renders catch up.** `/renders` and `/render-batches` gain signed callbacks
  (`callbackUrl`), `bind` on batches from a JSON or CSV source, a ZIP of a finished batch and
  delivery by reference. The callback uses the job callbacks' outbox, signature and retry
  ladder, and carries a 24-hour `x-lw-render-token` for that render's output or that batch's
  archive. Nothing is removed from `/jobs` or `/batch`.
- **Moving from a hosted render API.** Bannerbear V5, Bannerbear V2 and Placid request shapes
  on `/compat/`, off unless `renderApi.enabled`, with the durable render path underneath. Only
  `lwt_` tokens are accepted. A property the mapping does not name is refused with
  `422 PROPERTY_NOT_MAPPED`. `lw render-api inventory|check|sample|compare` lists templates,
  checks mappings and compares output. The adapters come from public documentation and fixtures
  and have not run against a live account.
- **HTML-layout tools render on the server.** A tool with no hooks whose template has no
  `<svg>` now goes to the Chromium worker. Without a worker it answers
  `501 SVG_TEMPLATE_REQUIRED` instead of a bare 500.
- **Design token colours.** Worker renders keep a colour input that points at a design token, such
  as `ink={color.brand.mint}`, instead of falling back to the tool's default.
- **Server renders of hooked tools work again.** The worker's request budget per render
  follows the app files the shell lists in `precache.json`, plus 256, between 512 and 4096, and
  1024 when the list cannot be read. A flat 512 refused QR codes and Design rules tools with "A
  render request could not be completed." This affected Lolly Work 1.1.1 to 1.1.3. One render
  now opens at most 32 requests at a time.
- **A busy worker is busy, not broken.** The worker's `/readyz` answers 200 while its browser is
  connected and reports `atCapacity`, so a full worker keeps its place in the Service. When the
  server cannot connect to a worker, it retries with backoff for up to
  `render.worker.connectRetryMs` and then answers `503 RENDER_BUSY` with `Retry-After: 5`
  instead of 502.
- **What a server render records.** A signed server render's Content Credential carries the
  design system, its label and the colourway (`designSystem`, `designSystemLabel`, `themes`), and
  for a partner `partnerCompany`, `partnerCompanyLabel`, `partnerProfileRevision`,
  `partnerProgramme`, `partnerProgrammeLabel`, `partnerKit` and `partnerKitRevision`. It never
  records the person, a token, an agent or the contact's details.

**Public files behind a CDN**

- **Bunny and Cloudflare.** An instance can put either provider in front of its public files,
  configured in the `edge` block of `instance.json`. Purges by tag or URL go through an outbox
  within each provider's budget when the brand, a pack, an overlay or the governance document
  changes; a purge never blocks or reverses that change. Tag headers (`CDN-Tag` for Bunny,
  `Cache-Tag` for Cloudflare) go only on answers a shared cache may store.
- **Jurisdiction.** Under the default `eu-only`, a provider whose company, edge locations or
  logs are not in the EU may front only a hostname marked `publicOnly`, and the instance's own
  hostnames can never be `publicOnly`. On such a hostname credential headers are removed, an
  answer that is not public becomes an empty `404 PUBLIC_HOST_ONLY`, and writes answer 405. Bunny
  counts as EU only when restricted to Europe with its logs stated as EU.
- **Checks.** `GET /api/v1/edge/providers/:id/verify` reads a zone's settings without writing,
  and reports image and page rewriting such as Bunny Optimizer and Cloudflare Polish, Mirage,
  Rocket Loader and Email Obfuscation. `lw edge probe` checks from outside that private answers
  and errors are not cached and that security headers pass through. An unreadable setting is
  never a pass.

**Permissions, links and errors**

- **Links stop with their maker.** `GET` and `POST /l/:id` answer `410 LINK_MAKER_DISABLED`
  while the account that made the link is disabled, and work again when the account is
  re-enabled. Offboarding still revokes links for good.
- **Grants that can never match.** `POST /api/v1/grants` refuses a rule whose resource the
  server never checks the action against, with `400 GRANT_NEVER_MATCHES` and the forms that do
  narrow. `tool:tag/<tag>` and `catalog:tag/<tag>` were two such forms. `GET /api/v1/grants`
  marks stored ones `neverMatches`, and the console says "Never matches".
- **Locks stay out of the artwork's way.** org-config no longer carries the overlay's name or
  the rule's reason on a locked input, so the app prints no policy line under the input. The
  console's policy editor, the `422 INPUT_LOCKED` body and the automation contract keep
  both.
- **A missing tool in plain words.** Every route that loads a tool answers `404 TOOL_NOT_FOUND`
  for a missing one and `500 TOOL_UNAVAILABLE` with one sentence for another filesystem failure.
  No answer gives a server path. An id that cannot name a tool directory is refused before
  anything is read.
- **A pack with two owners for one file.** `inspectPack` now refuses an asset index where two
  ids claim one catalogue file and gives the file and both ids. Before, such a pack mounted and
  its catalogue files answered 503.

**Retention and housekeeping**

- **Deleted documents can purge themselves.** `policy.retention.deletedDocumentsDays` lets the
  retention run remove deleted documents older than the window, in batches of 100. It is off at
  `0`, the default. Each run that purges writes a `retention.run` audit entry, and the readiness
  report flags an unset window for the internal profile.
- **Render output retention.** `policy.retention.renderOutputDays` expires finished render
  outputs after that many days, while the record, receipt and identity stay. It is off at `0`,
  the default. An output a delivery points at is never removed.
- **Migrations wait for the network.** The migration runner retries a connect refused with
  `ECONNREFUSED`, `EHOSTUNREACH` or `ENETUNREACH`, up to 20 times 500 ms apart, which covers a
  K3s NetworkPolicy that lets a new pod through a moment after its container starts. Any other
  error still fails at once.
- **Messages with an end.** `lw msg send` takes `--starts` and `--ends`, as a date and time with
  its zone.
- **Colourway asset treatments.** `colourway-asset-treatments` joins the governable flags, on by
  default. An admin can force the flag off and hide its toggle. The web app reads the flag once
  it offers colourway colours for icons and photos.
- **Console.** The packaged DAM guidance opens with a chooser that lists the services an
  organisation can run itself first, and the console's guides land on links written in Lolly's
  anchor form.
- **The local demo.** `pnpm run demo` builds its pack view from hard links, so its tool feed
  serves again.

## Changes for API clients and operators

**New routes**

- **Tokens.** `POST /api/v1/tokens` takes `scopes`, `tools` and limits.
  `PUT /api/v1/tokens/:id/programme`, `PUT /api/v1/tokens/:id/limits` and
  `GET /api/v1/tokens/:id/usage` (owner).
- **Agents.** `POST /api/v1/mcp`, and `GET /api/v1/context`, `/context/me`, `/context/brand`
  (with `/design-md`, `/tokens`, `/agents-md`, `/checks` and `/skills[/:slug/*]`),
  `/context/partner/company[/logo/:surface]`, `/context/partner/templates` and
  `/context/partner/kit[/logo/:surface]`.
- **Renders.** `GET /api/v1/render-batches/:id/archive`, `POST /api/v1/renders/:id/deliveries`
  and `POST /api/v1/intents/resolve`. `GET /api/v1/schema/:toolId?template=inst/<id>` returns
  the schema a render from that template takes.
- **Migration API.** `/compat/bannerbear/v5/images`, `/compat/bannerbear/v2/images`, their
  sync hosts, `/compat/placid/api/rest/images` and `/compat/placid/u/:uuid`, all answering 404
  until `renderApi.enabled`.
- **Approvals.** `GET /api/v1/approvals/:id`, `GET /api/v1/approvals/:id/artifact`,
  `POST /api/v1/approvals/:id/withdraw` and `POST /api/v1/approvals/match`.
- **Brand.** `/api/v1/brand/edits` and its `document`, `preview`, `rollback`, `keep`,
  `settings` and `revisions/:n` routes; `/api/v1/brand-pages` with `:slug/revisions` and
  `:slug/unpublish`; `/brand/:slug/*`, `POST /brand/:slug/mcp`, `/.well-known/lolly-brand.json`
  and `/api/v1/brand-pages/public`.
- **Catalogue rights.** `GET`, `PUT` and `DELETE /api/v1/catalog/rights/marks` and
  `/api/v1/catalog/rights/licences` (`catalog.edit`), and `GET /api/v1/catalog/rights/asset`,
  `/coverage` and `/collections`. `POST /api/v1/links?dryRun=1` lists which files a link would
  carry.
- **Programmes.** `GET /api/v1/programmes`, and `GET`, `PUT` and `DELETE /api/v1/programmes/:id`
  with `companies/:company` (and its `profile` and `kit`), `people`, `folders`, `templates`,
  `templates-only/:tool`, `tokens`, `usage`, `rights-report`, `rights/choices`, `exits` and
  `view-as`. `POST /api/v1/programmes/exit`, `GET`, `PUT` and `DELETE /api/v1/programmes/exits/:id`,
  `POST /api/v1/programmes/exits/:id/reopen` and `POST /api/v1/programmes/sweep` for a
  serverless cron. `/api/v1/partner-domains[/:domain[/check]]`. `/api/v1/me/company/profile`
  and `/api/v1/me/company/kit` for a company's own people. `POST /api/v1/view-as/end` and
  `POST /api/v1/org-config/preview/render`.
- **Edge.** `GET /api/v1/edge`, `GET /api/v1/edge/providers/:id/verify`,
  `POST /api/v1/edge/purge` and `PUT` and `DELETE /api/v1/edge/providers/:id/credential`, all
  under `instance.config`.
- **Limits.** `GET /api/v1/limits` (`policy.edit`) lists each enforced limit with its value and
  its source.

**New configuration**

- `policy.retention.renderOutputDays` and `policy.retention.deletedDocumentsDays`, both `0`
  (keep) by default.
- `policy.approvalArtifacts`: `enabled` `true`, `maxFileBytes` 64 MiB, `instanceBudgetBytes`
  1 GiB, `closedRetentionDays` 30, `approvedRetentionDays` `0` (keep) and `recordInCredentials`
  `true`. A withdrawn request's file goes at once.
- `policy.catalog.partnerRights`: `report` or `gate`. Unset, the instance's own recorded default
  applies.
- `automation.callbacks.allowedOrigins`, empty by default: exact HTTPS origins that render and
  job callbacks may reach beside `notify.webhook.url`. A URL elsewhere answers
  `403 CALLBACK_URL_NOT_ALLOWED`, redirects are refused, and origins without `LW_WEBHOOK_SECRET`
  stop the boot.
- `automation.tokenLimits`: `callsPerMinute` 120, `rendersPerDay` 2000 and `rendersPerMonth`
  `null`, for tokens in a programme. Over a limit a token gets `429 RATE_LIMITED` or
  `429 BUDGET_EXHAUSTED` with `Retry-After`. `rateLimit.enabled: false` does not turn these
  off.
- `render.worker.connectRetryMs`, default 30000, from 0 to 120000.
- `renderApi`: `enabled` `false`, `mappingsFile`, `templates` `[]`, `resultUrls.signedDays` 30
  (`0` means result URLs need the bearer token) and `urlApi.actAs`.
- `brandPages`: `enabled` `false`, `maxBundleBytes` 64 MiB, `maxFileBytes` 32 MiB,
  `instanceBudgetBytes` 1 GiB, `keepRevisions` 10 and an optional `approvalChain`; and
  `rateLimit.brandPage` with capacity 240 and 8 a second.
- `edge`: `jurisdiction` `eu-only` (or `any`) and `providers` `[]`, each with `id`, `kind`
  (`bunny` or `cloudflare`), `hostnames`, `publicOnly`, `credentialRef`, `options` and
  `jurisdiction`. Unknown keys fail the load. A credential can also be sealed in the database
  with `lw edge credential`.
- Tool overlays: `enforce.escalation` is writable and must name a chain that exists
  (`400 CHAIN_NOT_BOUND` otherwise), `enforce.approvalCovers` is `file` or `template-variants`,
  `bindings` maps inputs to company fields, and `defaults` takes the shape
  `[{ groups, values }]`.
- Programme records: `tokenLimits`, `approvalChains` and `templatesOnly`.
- Roles and actions: `brand-manager` (member plus `brand.edit`, `brand.page.publish` and
  `brand.switch`), granted only through an explicit `idp.roleGroups` mapping; `brand.edit`,
  `brand.page.publish` and `programme.manage` for admins; and the token-only `automation`
  role.

**New environment variable**

- `LW_RENDER_API_URL_SECRET` signs migration API result URLs. With `renderApi.enabled` and
  `renderApi.resultUrls.signedDays` above 0, the server refuses to start without this
  secret.

**Changed behaviour for API clients**

- Schema and the document verbs answer `404 TOOL_NOT_FOUND` for a missing tool, where they
  answered `400 DOCUMENT_API_ERROR`. A failed read that is not a missing file answers 500, so a
  durable render retries it within its attempts.
- `POST /api/v1/render` gives the refused input in its 422, as `GET` always did, and sends
  `Retry-After` with `RENDER_BUSY`.
- The served asset index writes instance asset checksums as `sha256-<base64>`.
- org-config carries no `by` or `reason` on an input.
- `/discovery/me` adds `token: { scopes, scopesVersion, tools }`, and its `can` bits, like
  `can.render` in `/discovery/tools` and `/schema`, reflect what the scopes reach. A scoped
  token cannot read `view=raw` of a schema.
- Instance asset bytes answer `private, no-cache` instead of `private, max-age=300`, and so do
  `/catalog/ext/...` bytes for programme members. Staff keep five minutes on
  `/catalog/ext/...`.
- Without a configured edge provider, no answer carries `Cache-Tag` or `Surrogate-Key`. Brand
  chrome and the hashed connect pack used to send both on every answer.

**On upgrade**

- **"Until approved" starts marking.** An instance that already holds
  `enforce.watermark: until-approved` shows PREVIEW on server renders and share links from the
  first render after the upgrade, because the setting was stored and not enforced until now.
  Change the rule first if that is not wanted.
- **Packs with two owners for one file stop a production boot.** A production server exits
  before it reaches the database and prints the file and asset ids. An evaluation server boots
  with a warning on the `pack` setup check, and its catalogue files still answer 503. Lolly Demo
  packs built from Lolly 1.1.2 or 1.1.3 are affected. Run `node scripts/inspect-pack.ts <pack>` before upgrading, and
  rebuild a refused pack from Lolly 1.2.0.
- **Tool grants reach the app.** A stored `tool.use` deny now hides the tool in the app as well
  as in Preview, and a deny for everyone (`*`) reaches anonymous callers on an open deployment.
  Review `tool.use` grants before upgrading.
- **Grants that never matched are marked.** Stored rules stay and are listed with
  `neverMatches`. `POST /api/v1/config/apply` re-applies one already stored and refuses a new one,
  and `LW_SEED_CONFIG` skips one with a warning.
- **Links stop with a disabled maker.** Links made by an account that is disabled at upgrade
  answer 410 until the account is re-enabled.
- **The licence gate reports first.** On its first start, 1.2.0 records the gate's mode once: `gate`
  when the database holds no accounts and `report` when it does. An upgraded instance therefore
  changes nothing partners receive, and its `partner-rights` setup check warns with what the gate
  would hold back. Set `policy.catalog.partnerRights: gate` to gate. The chart, Compose and
  appliance templates do not set the key, so re-applying them cannot flip the
  mode.
- **The approved file records the approval.** A server with a signing identity now adds the
  approval to an approved file's Content Credentials unless
  `policy.approvalArtifacts.recordInCredentials` is `false` or the requester opted
  out.
- **Signed server renders record more.** Their credentials gain the design system and colourway
  keys, so their bytes differ from 1.1.3's.
- **Render worker image.** The worker's readiness and request budget change in the worker
  image, so update the worker with the server. With several worker replicas, a job can now reach
  a busy pod and get `503 RENDER_BUSY`, where a busy pod used to leave the
  Service.
- **A database that is down takes about 10 seconds to fail** on the migration runner, `lw migrate`,
  the server's auto-migrate and the serverless function's bootstrap, instead of failing at once.

## Migrations

This release adds 21 SQL migrations since 1.1.3:

- `0077_edge_purge_outbox.sql` adds `edge_purge_outbox`, the queue of CDN purges, and
  `edge_provider_credentials`, edge credentials sealed with the instance credential key.
- `0078_token_scopes.sql` adds the `scopes` and `tools` columns to `api_tokens`.
- `0079_durable_render_parity.sql` lets `automation_callbacks` name a render or a render batch
  as well as a job (`job_id` becomes nullable, with a check that exactly one subject is named),
  adds `deliveries.source_render_id`, and adds an index for output retention.
- `0080_approval_artifact_uploads.sql` adds the `approval-artifact` scope to the `uploads` scope
  check.
- `0081_render_api_records.sql` adds `render_api_records`, one row per migration API request.
- `0082_approval_export_review_inputs.sql` adds a partial index on `approvals` by the export
  review's inputs digest.
- `0083_brand_pages.sql` adds `brand_pages` and `brand_page_revisions`, and the `brand-page`
  scope to the `uploads` scope check.
- `0084_brand_edits.sql` adds `brand_edit_revisions`.
- `0085_partner_programmes.sql` adds `partner_programmes`.
- `0086_programme_people.sql` adds `partner_companies` and `programme_memberships`.
- `0087_partner_domains.sql` adds `partner_domains`.
- `0088_partner_folders.sql` adds `partner_folders`.
- `0089_company_profiles.sql` adds `partner_company_profiles` and
  `partner_company_profile_history`.
- `0090_token_groups.sql` adds the `groups` column to `api_tokens`.
- `0093_programme_exits.sql` adds `programme_exits`, one receipt per ended or scheduled
  partnership.
- `0094_token_usage.sql` adds the `limits` column to `api_tokens` and `token_usage`, one row per
  token and UTC day.
- `0095_programme_tokens.sql` adds the `via` column to `api_tokens`.
- `0096_asset_rights_marks.sql` adds `asset_rights_marks` and `asset_licence_records`.
- `0097_programme_rights_choices.sql` adds `programme_rights_choices`, the share-anyway choices.
- `0098_instance_defaults.sql` adds `instance_defaults`, where the licence gate's mode is
  recorded on first start.
- `0099_company_kits.sql` adds the `kit` column to `partner_company_profiles`.

The numbers 0091 and 0092 were never used, and the runner accepts the gap. `pnpm run
migrate:classify` classes 17 files as additive and four as maintenance: `0079`, `0080`, `0082`
and `0083`. An install that sets `LW_MIGRATE_EXPECT` lists all 21 files or their manifest. An
older release can run on the new schema, with one limit: rolled back while render callbacks are
pending, it records those entries as `failed` and `not-sent` without sending them.


Before upgrading, check the database with `pnpm run migrate:status`, take a fresh verified
backup and complete an independent restore. Then apply the maintained migration runner or
the chart's migration Job, against the selected instance only. The maintained history now
has 88 files.

## Deployment

- **Helm chart 1.2.0.** The chart's version is the release version. It gains no values or
  templates. The render worker's readiness probe comments describe the new readiness, and
  `values-internal.yaml` names `retention.deletedDocumentsDays` among the retention settings to
  approve. `LW_RENDER_API_URL_SECRET` has no chart value of its own; supply it through
  `extraEnv`. The chart is published through `publish-helm.yml` from the release
  commit.
- **Admission policy, K3s and the admission adapter.** The Kubewarden policy set and the K3s kit
  are unchanged since 1.1.3, and the admission adapter changes only its version.
- **The appliance.** On k3s, `lolly-update check` verifies the published chart through the
  channel and installs the chart without `--keep-chart`, as the 1.1.2 to 1.1.3 acceptance
  showed on aarch64 and on x86_64. `accept-updates.py` reads the starting release from the
  machine's update state. No appliance image is published.
- **The demo pack is Lolly Demo.** `packs/demo`, which the server image, the chart's default
  pack and the appliance mount, now holds Lolly Demo in place of SUSE, and the
  `lolly-demo-brand-1.1.3.lolly` instance pack replaces `suse-brand-1.0.0.lolly`. An evaluation
  instance on the default pack
  shows the Lolly wordmark and Lolly Demo's colours after the upgrade. The console and sign-in
  pages read a design system's colourways.
- **YunoHost.** 1.1.3~ynh2 set `LW_CATALOG_SIGNING_KEY` to a key generated for each
  installation, with `instance.catalogPublicationGeneration` and `instance.catalogPublicKey`, so
  the app lists tools on YunoHost 13. The package
  now also finds a Nextcloud on the same server and prefills **Configuration > Nextcloud**.
  Once an administrator turns on **Connect Nextcloud** and pastes an app password, the panel
  writes a config-managed WebDAV catalogue source and delivery destination to `instance.json`,
  with the password reaching the server only as `LW_PROVIDER_NEXTCLOUD` and
  `LW_DESTINATION_NEXTCLOUD`. nginx and the SSOwat permissions pass `/brand/<slug>/` and
  `/.well-known/lolly-brand.json` to the server. The shell headers keep `https://lolli.li` for
  the on-device models.
- **Docker Compose.** An optional `garage` profile adds a single-node Garage S3 store on the
  Compose network only, for `blobs.driver: "s3"`, with `GARAGE_RPC_SECRET` and
  `LW_BLOBS_S3_CREDENTIAL` in `.env`. It starts only with `--profile garage`.
- **Coolify.** `deploy/coolify/lolly-work/docker-compose.yml` is generated from the same
  services as the Dokploy blueprint. It routes the domain with `SERVICE_FQDN_SERVER_8787`, takes
  the database password and the session, link and credential secrets from
  `SERVICE_PASSWORD_64_*`, and will not deploy until `LOLLY_OWNER_EMAIL` is set. It is imported
  as a Docker Compose resource and has not yet been run on a live Coolify host.
- **Caddy.** The VM Caddyfile sends `/compat`, `/brand/<slug>/` and
  `/.well-known/lolly-brand.json` to the server.
- **The ready-made package.** Its pins moved to the 1.1.3 pair in October and move to the
  1.2.0 pair after this release is published.

## Prepare and qualify

This section is for Lolly Work maintainers cutting the release.

**Maintainer commands**

The commands are the same as for 1.1.3, with `vendor/lolly` at the Lolly source
above:

```text
node scripts/vendor-content-resolver.ts --write
pnpm run repin-engine --apply
pnpm run verify:engine-pin
pnpm run typecheck
```

The packaged documentation comes from a Lolly commit that contains this page:

```text
node scripts/sync-docs-bundle.ts --source=/path/to/lolly --commit=<full-commit-sha>
pnpm run verify:docs-pin
```

Before tagging or publishing images, the exact final Lolly Work commit needs ordinary
CI, including the native server image checks and the real Chromium worker checks
with the matched signed shell. The tagged server and worker images must come from
that same Lolly Work commit.

## YunoHost packaging

Lolly 1.2.0 publishes a new web archive, and the Lolly Work YunoHost package pins the
`lolly-web-1.2.0-ynh1.tar.gz` archive above. The maintained producer cuts the package on
the final Lolly Work commit:

```text
node scripts/yunohost-release.ts --ynh-rev 1 --shell-url https://lolli.li/lolly-web-1.2.0-ynh1.tar.gz --shell-sha256 3a324eef05128d32c6154ab88e360c40a8235ee181c3b49abe4ef5b556d1ac0f --out ABS_NEW_ARTIFACT_DIRECTORY
```

Commit the generated manifest, recut into a separate directory and require full
archive byte equality, as for 1.1.3. The package is mirrored to `lolly-work_ynh` and
qualified with a `yunohost-runtime.yml` run after publication. Until then it is not
qualified.

## Images and qualification

The release workflow builds, signs and publishes the server and render-worker images
from the `v1.2.0` tag push. The release's `release-source-images.json` records their
verified digests. Both are signed keylessly with identity
`https://github.com/lolly-tools/lolly-work/.github/workflows/release.yml@refs/tags/v1.2.0`,
the identity `lolly-update` accepts.
