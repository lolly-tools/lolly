# API surface

Every route the console and the CLI use - they share one API, so the two surfaces stay in
parity by construction. Errors are `{ error: { code, message } }` with an honest HTTP status.

"Action" is the RBAC action the caller must hold ([permissions](permissions.md)); *member*
means any signed-in member; *public* means no session needed.

## Health and metrics

| Route | Action | Notes |
|---|---|---|
| `GET /healthz` | public | `{ ok, name, accessMode, appUrl? }` - liveness |
| `GET /readyz` | public | `{ ok, store }`, 503 while the store cannot answer - readiness |
| `GET /metrics` | token | Prometheus; loopback-only unless `LW_METRICS_TOKEN` is set |

## Instance manifest and the connect surface

| Route | Action | Notes |
|---|---|---|
| `GET /api/v1/instance` | public | the card a fresh shell reads before sign-in |
| `GET /connect/pack.lolly` | open: public · else member | the hosted signed instance pack; `404` when none is hosted; `ETag` + `If-None-Match` → `304` |
| `GET /api/v1/instance-pack` | `fleet.view` | the hosted pack's metadata (name, version, signed, checksum), or null |
| `PUT /api/v1/instance-pack` | `instance.config` (**owner**) | host a pack cut by the OSS builder; refused unless its instance base is this deployment |
| `DELETE /api/v1/instance-pack` | `instance.config` (**owner**) | stop hosting |

The manifest is what a downloaded app learns about this deployment before
anyone signs in: `{ name, accessMode, provider, providerName, loginPath,
engineVersion, capabilities, brand, connect? }`. `engineVersion` is the vendored
engine pin this deploy serves tools against; `capabilities` identifies the surfaces
the server ships (`catalog`, `collab`, `submit`, `scim`); `connect.packUrl`
appears exactly while a pack is hosted. It carries no secrets and no user
data, and shares the auth rate-limit bucket. Any origin may read it
(`Access-Control-Allow-Origin: *`, with `OPTIONS` answering the preflight),
because a client that adds this deployment's design system by URL fetches this
card from its own page before anyone has signed in. The pack itself is never built
here - the OSS repo's `build-instance-pack.ts` owns the signed format, and
this instance is where the finished pack publishes to. See "Connecting apps to
this instance" in [operations](operations.md) for the connect story.

`brand` is the design system this deployment hosts, for a client that adds one
by URL and keeps it on the device for offline use (OSS `plans/186`):

```json
"brand": {
  "profile": "suse",
  "label": "SUSE tokens",
  "version": "1.2.0",
  "checksum": "sha256-QOn2…",
  "locked": true,
  "packUrl": "https://brand.example/connect/pack.lolly"
}
```

Every field comes from the mounted pack itself, never from a second copy here.
`profile` is the active brand profile on a profile-aware pack (the one
`GET /api/v1/brand/profiles` lists) and `null` on a single-brand one; `label` is the
tokens asset's name; `checksum` is that asset's own integrity checksum, which is
what a client compares to ask "has the brand here changed since I copied it"
without downloading anything; `locked` mirrors the tokens asset's `brandLock`,
so a client knows the brand is authoritative and must not offer to customise it;
`version` is the hosted pack's version when one is hosted; `packUrl` repeats
`connect.packUrl` so one block answers both what is here and where to download the pack.
The whole block is `null` when the pack ships no tokens asset, and it changes
the moment an admin switches brand profile. It states no colours and no font
files: those stay behind `GET /api/brand`.

The pack download is conditional. `GET /connect/pack.lolly` sends a strong
`ETag` (the hosted pack's checksum, the same one `GET /api/v1/instance-pack`
reports) with `cache-control: private, no-cache`, and answers `304` to an
`If-None-Match` that matches, so a client re-checks a pack it already holds for
the price of one header. The access gate is unchanged and runs first: on a gated
instance an unauthenticated conditional request gets `401` and no tag.

Cross-origin reads of the pack follow that same gate. An **open** instance sends
`Access-Control-Allow-Origin: *` and `Access-Control-Expose-Headers: ETag` (a
browser hides the tag from script otherwise, and the tag is what the client came
for), and answers the `OPTIONS` preflight a conditional GET triggers with
`Allow-Methods: GET`, `Allow-Headers: If-None-Match` and a day of `Max-Age`. A
**gated** instance sends no CORS header at all, on the download or the
preflight: a page on another origin cannot present the session cookie, and a
wildcard with credentials is refused by browsers, so the answer there is to sign
in on the instance and export the pack, or connect from the desktop app.

## Auth

| Route | Action | Notes |
|---|---|---|
| `GET /api/auth/config` | public | what the sign-in screen needs (mode, IdP display name, and `providers: [{ id, name, kind, loginPath }]` with `kind` `oidc`, `github` or `password`), plus `instanceName` (`instance.name`), `inviteOnly` (`true` while `idp.admission` is set) and `joinRequests` (`policy.requests.join`: the refusal page offers Ask to join) |
| `GET /api/auth/login` | public | starts sign-in with PKCE: OIDC, or GitHub OAuth 2.0 for `?idp=` naming a `kind: "github"` entry; for a `kind: "password"` entry, the email and password form. With several entries and no `?idp=`, the chooser; `404 NO_IDP` with no sign-in configured |
| `POST /api/auth/password/login` | public | the form (`email`, `password`, `returnTo`, `csrf`) answers `303` to `returnTo` with `lw_session`, or the form again with `400` and one message for an unknown email, a wrong password and a locked address. A JSON body `{ email, password, returnTo? }` answers `{ ok, returnTo }` or `400 INVALID_CREDENTIALS`. A refused admission is `403`; an owner's account reached with a password not set from an owner's link is `403 OWNER_LINK_REQUIRED`. `503 BUSY` with `Retry-After` while too many password checks wait. See [identity.md](identity.md#email-and-password) |
| `GET /api/auth/password/set?token=…` | public | the page a one-time link opens: the address, read-only, an optional name, and a new password twice. A used, expired or unknown link, or one its issuer may no longer issue, is a `410` page |
| `POST /api/auth/password/set` | public | the form (`token`, `name`, `password`, `confirm`, `returnTo`, `csrf`): spends the link once, sets the password, ends the account's other sessions, signs the person in and answers `303` to `returnTo`. `name` is optional, 1 to 80 characters once trimmed, and becomes the account's display name. `returnTo` is set only by the [invite page](#invite-links-and-access-requests); a value that is not a path on this origin, or none, is `/` |
| `GET /api/auth/callback` | public | verifies the `id_token` (OIDC) or reads the GitHub profile and emails, then mints `lw_session`. A failure a browser sees is an HTML page with a way to start again; an API caller without `Accept: text/html` keeps the JSON error, except GitHub failures, which are always the page |
| `GET /api/auth/link?idp=<id>&returnTo=<path>` | member (cookie) | runs that IdP and links the identity it returns to the current user, then redirects to `returnTo`; no new session. An identity that belongs to someone else is a `409` HTML page. A `password` entry is not linked from here: a `400` HTML page says to ask an admin for a sign-in link, with a link back to `returnTo`. See [identity.md](identity.md#one-person-several-sign-ins) |
| `GET /api/v1/me/identities` | member | the person's linked sign-ins: `{ identities: [{ idp, subjectHash, displayName, email, emailVerified, linkedAt, lastLoginAt, canUnlink, unlinkBlocked? }], available: [{ id, name, kind, linkPath }] }` |
| `DELETE /api/v1/me/identities/:idp/:subjectHash` | member | `204`: the removal ends every session of the account, and the browser that asked gets a fresh session cookie in the same chain (the same `authAt` and sign-in time, cut at `authAt + sessionMaxHours`; see [identity](identity.md#session-length-and-renewal)). No cookie when the request carried no session cookie of the person's or that chain has reached its cap, and the person signs in again. `409 ACCOUNT_SIGN_IN` for the sign-in the account was created with, `409 LAST_SIGN_IN` for the last one |
| `POST /api/v1/me/revoke-sessions` | member (own session cookie) | sign out on all devices: bumps the caller's own session epoch, so every session they hold ends on its next request, and clears `lw_session` and `lw_guest` on this browser. `204` with `cache-control: no-store`. A service token, a bearer caller or an agent acting for someone gets `401`. Five calls an hour per person, then `429 RATE_LIMITED` with `retry-after: 3600`. Audited `user.sessions.revoked` with `{ self: true }` |
| `GET /api/auth/dev?email=…` | public | dev provider only; `404` when `dev.enabled` is false |
| `GET /api/auth/session` | member/guest | the current principal |
| `POST /api/auth/logout` | any | clears both cookies |
| `POST /api/v1/auth/device` | public | start device sign-in: `{deviceCode, userCode, verificationUri, interval, expiresIn}` |
| `POST /api/v1/auth/device/token` | public | the device's poll: `{status}` of `pending`/`denied`/`expired`, or `approved` + the session cookie (single read). The cookie continues the approving browser's chain and ends no later than its `authAt + sessionMaxHours` (`sessionTtlHours` from that sign-in while renewal is off); once that chain has ended the answer is `denied`, audited `auth.denied` with `reason: 'session-max'` |
| `GET /activate` | member (page) | where a person types and confirms a device code - approval binds the approver's identity, so it lives here and nowhere else |
| `GET /api/v1/auth/device/pending` | `fleet.view` | pending codes, oldest first |
| `POST /api/v1/auth/device/deny` | `fleet.manage` | refuse a pending code from the console |

## The polled document

| Route | Action | Notes |
|---|---|---|
| `GET /api/v1/org-config` | member | the one document a shell polls; ETag'd on policy version and `inboxUnread`, the same count `GET /api/v1/inbox` answers as `unread` for the same `X-Lolly-Client` (its shell and engine selectors apply to both) |
| `GET /api/v1/org-config/preview?groups=a,b` | `policy.edit` | what a member in those groups would receive |

## Catalog

| Route | Action | Notes |
|---|---|---|
| `GET /catalog/*` | per access mode | pack blobs, lifecycle-gated |
| `GET /api/v1/catalog/assets` | per access mode | one page of the caller's feed: `q`, `source`, `section`, `collection`, `tag`, `type`, `cursor`, `limit`; returns `{ assets, total, nextCursor, facets, version }` ([large catalogs](catalog.md#large-catalogs)) |
| `GET /api/v1/catalog/assets/*` | member; visible asset | inspect source facts, organisation fields and text-index status without returning extracted words |
| `GET /api/v1/catalog/search` | `catalog.read` | live fan-out to search-capable providers |
| `PUT /api/v1/catalog/assets/<id>/meta` | `catalog.edit` | org-defined field values and `replacedBy` on any asset the caller sees; `name`/`description`/`tags` on `inst/*` only |
| `PUT /api/v1/catalog/text-index/<id>` | `catalog.edit` | explicitly save reviewed text with `sourceRevision`, `fileId` and `method`; `text: null` clears; stale revisions return 409 ([reviewed text](catalog.md#reviewed-text-from-the-assets-inspector)) |
| `GET /api/v1/catalog/assets/<id>/versions` | `catalog.read` | one instance asset's byte history, newest first, with the served version and the retention ceiling |
| `PUT /api/v1/catalog/assets/<id>/head` | `catalog.edit` | roll back: `{ "version": N }` points the head at a version that already exists |
| `DELETE /api/v1/catalog/assets/<id>/versions/<n>` | `catalog.edit` | `409 VERSION_IS_HEAD` for the served version, `409 ASSET_HELD` while a hold is set |
| `GET /catalog/inst/<id>/<format>?v=N` | per access mode | a prior version's bytes, through every gate the head answers to |
| `GET /api/v1/catalog/fields` | `catalog.read` | the org's field definitions, plus a `canEdit` bit for honest UI |
| `PUT/DELETE /api/v1/catalog/fields/<id>` | `policy.edit` | define or retire one field; the definitions also ride the governance document |
| `GET /api/v1/catalog/tags[?provider=<id>]` | `policy.edit` or `catalog.provider.manage` | every label the catalog carries, counted per source, with the rules hiding each one |
| `PUT /api/v1/catalog/tags/rules` | `policy.edit` (scope `*`), `catalog.provider.manage` (scope `provider:<id>`) | `{ scope, hidden }` replaces a hidden-tag list, `{ scope, hide, show }` edits it; applied when the index is served |
| `GET /api/v1/catalog/collections` | `catalog.collection.manage` | the curator's view: every set as curated |
| `GET/PUT/DELETE /api/v1/catalog/collections/<id>` | `catalog.collection.manage` | create, edit or remove one set; a `PUT` refuses any member the curator cannot see |
| `GET /api/v1/catalog/lifecycle` | `catalog.expire` | all lifecycle rows |
| `PUT /api/v1/catalog/lifecycle/*` | `catalog.expire` | set/merge a row; `revoke: true` revokes |
| `POST /api/v1/catalog/scan/*` | `catalog.scan` | record a C2PA scan result for one asset ([c2pa](c2pa.md)) |
| `GET/POST /api/v1/injectables`, `DELETE …/:id` | `catalog.injectable.manage` | the assets/tools injected into member shells |
| `GET /api/v1/brand/profiles`, `PUT /api/v1/brand/profile` | member + `catalog.read` / `brand.switch` | inspect sources; compatible profile selection |
| `POST /api/v1/brand/changes/preview`, `POST /api/v1/brand/changes` | `brand.switch` or `instance.config`, action dependent | preview impact; apply against the reviewed revision |
| `GET /api/brand`, `/api/brand/logo/:variant`, `/api/brand/font/:file` | public | brand chrome only (tokens, wordmark, woff2) so the sign-in screen is on-brand |

The [design-system administration contract](design-system-administration.md#review-and-apply) describes additive inventory fields, action permissions, replacement requirements and `409 STALE_PREVIEW`. The public instance descriptor adds `branding: { revision, sourceId }` even when `brand` is null; authenticated org configuration carries the same pair. `X-Lolly-Brand-Revision` reports the request snapshot. A request carrying a different revision is rejected with `409 BRAND_REVISION_CHANGED` so a render cannot combine source revisions.

## Catalog submit

| Route | Action | Notes |
|---|---|---|
| `POST /api/v1/catalog/submit?name=…` | `catalog.submit` | raw bytes in the body; `201` for a new asset, `200` with `duplicate: true` for identical bytes |
| `POST /api/v1/catalog/submit?name=…&projectId=…&fileId=…&checksum=…` | `catalog.submit` and current project read access | empty body; admits the verified ready project original through the same scan, quota and review pipeline; project files must be enabled on a durable store; service tokens are refused |
| `POST /api/v1/catalog/submit?type=template\|user-tool` | `catalog.submit` | a template or user tool as JSON; `toolId=` identifies the tool when the body does not; `422 INVALID_SUBMISSION` when the JSON or its tool is not one this pack can serve; `clientRef=` is echoed on the submission |
| `POST /api/v1/catalog/submit?assetId=inst/…&note=…` | `catalog.edit` | the same pipeline, landing as the next VERSION of an existing asset; `groups`/`type`/`tags`/`description` are refused here and belong to `…/meta` |
| `GET /api/v1/catalog/submissions` | `catalog.read` | the caller's own submissions plus the ones open on a step their groups may act on |
| `GET /api/v1/catalog/submissions/:id/bytes` | `catalog.read` | preview before publication - submitter and reviewer only |
| `PATCH /api/v1/catalog/submissions/:id` | `catalog.read` | correct a pending submission's `name`/`type`/`tags`/`description` and its org `fields`, and (with `catalog.collection.manage`) the `collectionId` it joins on approval; `409` once it has settled |
| `POST /api/v1/catalog/submissions/:id/act` | member (the approvals engine gates it) | `approve` publishes, `reject` returns with the comment |

Project-source intake requires the observed whole-file SHA-256. Work verifies every
stored part and the complete file, then checks source access again after scanning.
The source file stays unchanged. `groups=` selects library exposure independently
of project membership; omitted groups mean every workspace member. Only groups the
submitter belongs to are accepted. `type`, `toolId` and `assetId` cannot be combined
with a project source. Source identifiers are retained privately in the submission
and audit event, never in the public catalog entry.

Retries for the same person, project file, checksum and audience return the existing
live or pending submission. Concurrent admissions of the same source are serialized
by a transaction advisory lock in Postgres; contention returns `409 SUBMISSION_BUSY`.
A pending record left without an approval by an interrupted admission returns
`503 SUBMISSION_INCOMPLETE` for administrator inspection instead of creating another
asset or claiming review has started. A changed or inaccessible source returns
`404 NOT_FOUND`; verification failures return `422 SOURCE_UNAVAILABLE`; access lost
during scanning returns `403 SOURCE_CHANGED`.

Refusals: `413 PAYLOAD_TOO_LARGE` over `policy.submit.maxBytes`, `409 QUOTA_EXCEEDED`,
`422 SCAN_REJECTED` when the pre-store hook vetoes, `502 SCAN_UNAVAILABLE` when it cannot
answer and `onError` is `reject`, `503 SUBMIT_CHAIN_MISSING` when `policy.submit.chain` names
a chain the instance does not have. The preview route answers `410 ASSET_EXPIRED` once the
published asset's lifecycle stops it, like every other surface that hands out bytes. See
[catalog](catalog.md#submitting-an-asset).

## Catalog providers

| Route | Action |
|---|---|
| `GET /api/v1/catalog/providers`, `GET …/setup`, `GET …/:id`, `GET …/:id/health`, `GET …/:id/drift` | `catalog.provider.read` |
| `POST /api/v1/catalog/providers`, `PUT …/:id`, `DELETE …/:id`, `POST …/preview`, `POST …/:id/setup-preview`, `POST …/:id/sync`, `POST …/:id/materialize`, `POST …/:id/import` (one asset) | `catalog.provider.manage` |
| `PUT/DELETE …/:id/credential`, `POST …/:id/oauth/start`, `POST …/:id/enable`, `POST …/:id/disable`, `POST …/:id/cutover` | `catalog.provider.credential` (**owner**) |
| `POST …/:id/publish` | `catalog.provider.publish` (**owner**) |

Config-managed providers reject mutations with `409 CONFIG_MANAGED`.
Cutover returns `422 ORIGINALS_UNAVAILABLE` for a source that explicitly provides renditions
without protected originals. The refusal leaves identities, aliases and activation state unchanged.

`GET …/setup` returns versioned public typed-form descriptors (WebDAV and Google Drive),
credential sealing availability and the installed browser-consent redirect URI/scope,
with no secrets. Provider wire records include `guidedSetupAvailable`; advanced settings
outside the guided subset do not receive the guided resume action. `POST …/preview` with `setupVersion: 1`
validates that guided configuration and tests a bounded paged listing plus one streamed
original. The response includes `pages`, `scanned`, `sampleTotal`, `truncated`, exposure and
availability exclusions, mapper notes and `original: {ok,bytes?,sha256?,contentType?,detail?}`.
No source, file or credential is persisted. The guided limits are five pages, 1,000
distinct files, 2 MiB per XML/Drive metadata response, 32 MiB per original and 30 seconds overall. Legacy
preview and exclusive `shape: true` diagnostics retain their existing contracts.
Creation and `PUT …/:id` accept `setupVersion: 1` to validate the guided subset; guided
updates require a disabled source. `POST …/:id/setup-preview` tests a guided DB-managed
Google Drive source using its sealed credential, without returning the credential. Its response adds
`revision`, a digest of the configuration and credential identity. `POST …/:id/enable`
accepts `{setupRevision}` and refuses `409 SETUP_CHANGED` if it no longer matches, including
changes during the health check. This optional guard preserves advanced activation contracts;
creation, credential storage, sync and enabling retain their separate audited permissions.

`POST …/:id/oauth/start` accepts `{clientId,clientSecret}` for a disabled, guided DB-managed
Google Drive source. It requires an owner browser session, credential sealing and a suitable
instance URL. It returns `{authorizeUrl}` plus an encrypted HttpOnly/SameSite state cookie
with a ten-minute lifetime, bound to the member session and source revision. Its client
secret and PKCE verifier are sealed with a separate credential-key context; refresh tokens
are never put in browser cookies or responses. Only the latest consent in a browser is pending.
`GET /api/auth/provider-oauth/callback` checks state, session, current permission and source
revision, exchanges the code on Google's fixed endpoint with PKCE, checks offline read-only
scope and folder access, then seals the credential. JSON replies are capped at 64 KiB with
a 20-second aggregate exchange deadline. Failed/declined consent preserves the old grant.
The callback clears the state cookie and redirects to `/admin#/providers?setup=<id>&oauth=…`
with a safe outcome (`connected`, `denied`, `expired`, `changed`, `failed`); codes, vendor
error descriptions and credentials are not reflected. Reconnecting requires a disabled
source. Google Drive is the only browser-consent kind in this version.

## Outbound delivery

| Route | Action | Notes |
|---|---|---|
| `GET /api/v1/destinations` | authenticated; results filtered by `delivery.create` per target | safe fixed-target descriptors visible to this caller; never endpoints, bucket names, prefixes or credential refs |
| `POST /api/v1/destinations/:id/deliveries?name=…&format=…` | `delivery.create` on `destination:<id>` | verified Lolly export as the raw body; `201` after immediate delivery, or `202 awaiting-approval` when the target binds a chain |
| `POST /api/v1/jobs/:id/deliveries` | job owner + `delivery.create` on the body’s `destinationId` | deliver a completed render job’s retained output by reference; JSON `{destinationId,name,format?}` |
| `GET /api/v1/deliveries` | authenticated | caller's own delivery history remains readable after permission loss |
| `GET /api/v1/deliveries/:id` | authenticated | caller's own delivery receipt; another principal receives 404 |
| `POST /api/v1/deliveries/:id/retry` | `delivery.create` on the destination | retry failed/stalled work from its immutable staged bytes; refuses a changed destination |

Both create routes accept `Idempotency-Key`; repeating the same delivery returns its existing
record without another provider write, while reuse for different bytes/metadata returns
`409 IDEMPOTENCY_KEY_REUSED`. The raw body, or the referenced job output, must carry Lolly's
C2PA export assertion. See
[outbound delivery](delivery.md).

## Policy and governance

| Route | Action |
|---|---|
| `GET /api/v1/policy/tools` | `policy.edit` |
| `PUT /api/v1/policy/overlays/:toolId` | `policy.edit` |
| `GET /api/v1/policy/flags`, `PUT /api/v1/policy/flags/:flagId` | `policy.edit` |
| `GET /api/v1/grants` | `grant.edit` |
| `POST /api/v1/grants`, `DELETE /api/v1/grants` | `grant.edit` + owner for owner-only actions |
| `GET /api/v1/config/export` | `policy.edit` |
| `POST /api/v1/config/apply?dryRun=1&prune=1` | `policy.edit` (+ owner for owner-only grants) |
| `GET /api/v1/chains`, `PUT /api/v1/chains/:id` | member / `policy.edit` |

## People and groups

| Route | Action |
|---|---|
| `GET /api/v1/users`, `GET /api/v1/users/:id` | admin/owner role |
| `POST /api/v1/users/:id/revoke-sessions` | `grant.edit` - sign-out-everywhere: bumps the user's session epoch, every prior cookie and token fails its next request |
| `DELETE /api/v1/users/:id` | `instance.config` (**owner**) - erasure: deletes the row + de-attributes telemetry; `409` while they own unarchived projects |
| `POST /api/v1/retention/run` | `instance.config` (**owner**) - apply the stated retention policy now, and remove expired unfinished project-file uploads (`projectFilesSwept`) |
| `GET/POST /api/v1/groups`, `DELETE /api/v1/groups/:name` | `grant.edit` |
| `PUT /api/v1/users/:id/local-groups` | `grant.edit` |
| `POST /api/v1/users/:id/disabled` | `grant.edit` |
| `GET /api/v1/users/:id/identities` | admin/owner role | that person's linked sign-ins, the same rows as `/api/v1/me/identities`. With a `password` entry configured, also `password: { set, email, lockedUntil? }`: whether the person has a password, the address a new link would be for, and until when it is locked |
| `DELETE /api/v1/users/:id/identities/:idp/:subjectHash` | `grant.edit` | `204`, and every session of that person ends; the same two refusals; an owner's sign-ins are owner-only. Removing a `password` sign-in deletes the password (also from `DELETE /api/v1/me/identities/...`) |
| `POST /api/v1/users/:id/password/unlock` | `grant.edit` | `204`: lifts a lock that wrong passwords set, keeping the password. `404 NO_PASSWORD` when the person has none; an owner's is owner-only |

## Invitations

Who may sign in when `idp.admission` is set, one email address at a time. See
[identity](identity.md#who-may-sign-in) for how sign-in uses an invitation.

| Route | Action | Notes |
|---|---|---|
| `GET /api/v1/invitations` | `user.invite` (admin, owner) | every invitation, newest first, revoked ones included; plus `signInUrl`, `admission: { policy, invitations }`, and what an invite message needs: `providers` (the names of the sign-ins on offer), `passwordSignIn` (a `password` entry is configured), `passwordDomains` (`policy.invites.passwordDomains`) and `inviteNote` (`instance.inviteNote`, or `null`) |
| `POST /api/v1/invitations` | `user.invite` | body `{ emails: string[], groups?: string[], expiresAt?, passwordSetup?: boolean }`; `201` when anything was created, `200` otherwise. With `groups`, an address that already belongs to an account joins them now (`status: "applied"`) or is left alone (`status: "refused"`, `reason`: `self`, `account-disabled`, `owner-only`). Without `groups`, such an address is `status: "already"` and no invitation is written. A new address follows `policy.invites`: `reason` `invites-not-allowed` or `domain-not-allowed`. Each invitation in the answer carries its `link` and `expiresAt` |
| `POST /api/v1/invitations/:id/link` | `user.invite` | New link: `200 { invitation }` with a new `link`. Every link copied earlier for this invitation, from the console or a project, stops working, and `openedAt` is cleared. Refused for an accepted or revoked invitation; 10 a day per invitation, then `429 RATE_LIMITED` |
| `POST /api/v1/invitations/:id/reinvite` | `user.invite`, with the same group controls as `POST` | Invite again, for an expired or revoked invitation: body `{ expiresAt? }`; `201 { invitation }`, a new invitation with the same address, groups and projects and a new link. `409 ACTIVE_INVITATION { invitation }` when the address already has a live one |
| `DELETE /api/v1/invitations/:id` | `user.invite` | revoke; `404` when the id is unknown or already revoked |
| `POST /api/v1/admin/password-links` | admin or owner session with `user.invite` | body `{ email, purpose: "setup" \| "reset" }`; `201 { url, expiresAt }`: a one-time link to set a password, valid 7 days, which cancels the address's earlier unused links. `404 NO_PASSWORD_SIGN_IN` without a `password` entry, `409 NOT_ADMITTED` for an address admission refuses, `409 ACCOUNT_DISABLED`, `403 OWNER_ONLY` unless an owner asks for an owner's address or for an account that already signs in another way (an admin's own account excepted). The same rules are asked again when the link is used. Service tokens are refused |

An invitation reads:

```ts
{
  id, email, groups, invitedBy, inviter: { name } | null,
  createdAt, expiresAt, acceptedAt, acceptedUserId, acceptedUser: { name, email } | null, revokedAt,
  status: 'pending' | 'accepted' | 'expired' | 'revoked',
  projects: [{ projectId, name, role, invitedBy: { name } | null }],
  createdVia: 'console' | 'project' | 'request',
  link,                      // the workspace invite link; only while pending, else null
  linkVersion, openedAt,     // openedAt: the first sign-in started from a link, or null
  passwordSetup,             // the link may set a password for the address
  password: 'none' | 'set',  // whether the address already has a password
}
```

Absent dates are `null`. `projects` are the projects the person joins on acceptance (empty
for an invitation that only admits and groups), each with the name of the person who added
that project. `createdVia` is `console` (this route), `project` (a project invite) or `request` (an
approved [request](#invite-links-and-access-requests)). `inviter` and `acceptedUser` carry
names for the console; `acceptedUser.email` is the address the account signed in with,
which can differ from the invited one (a GitHub account with the invited address as a
secondary one). POST answers `{ invitations: [...], signInUrl, admission }`: an invitation
carries `created: boolean`, and an address handled without one reads
`{ email, status: "applied" | "refused" | "already", reason?, userIds, groups, created: false }`.

- `emails`: 1 to 200 addresses, trimmed, lowercased and deduplicated. Each must look
  like `local@domain` with no spaces.
- `groups`: local group names, the same slug rule as `POST /api/v1/groups` (letters,
  digits, `.`, `_`, `-`, 64 characters at most), at most 50. Attaching groups carries the
  controls of `PUT /api/v1/users/:id/local-groups`:
  - the caller also needs `grant.edit` (`403 FORBIDDEN`);
  - a group that maps to the owner role needs the owner role (`403 OWNER_ONLY`);
  - a group that maps to any role above the caller's is refused (`403 ROLE_ESCALATION`);
  - a group holding a grant for an owner-only action needs the owner role
    (`403 OWNER_ONLY_ACTION`);
  - each group must be in the local registry (`400 UNKNOWN_GROUP`). An owner may also
    name an IdP group or a role group, which the first admitted sign-in adds to the
    registry;
  - an address that already belongs to an account gets the groups at once
    (`status: "applied"`, with the `userIds` changed), under the same controls, and is
    refused for your own account (`self`), a disabled one (`account-disabled`) and an
    owner's unless an owner is inviting (`owner-only`). Only an account that has shown
    it holds the address counts: a sign-in whose IdP verified it, a trusted source (the
    reverse proxy, an IdP set to `emailVerification: "trusted"`), an accepted invitation
    for it, or an account provisioned with no sign-in yet. An account that only claims
    the address gets an invitation, which a verified sign-in has to accept.
- `policy.invites` applies to each address that gets an invitation: the `allow` tier
  (`invites-not-allowed`) and the `domains` list (`domain-not-allowed`). It does not
  apply to the `applied` branch. `maxTtlHours` is for in-app invites; this route takes
  its own `expiresAt`.
- `expiresAt`: optional ISO 8601 date-time, in the future and within 366 days. It bounds
  acceptance only; an accepted invitation keeps admitting until someone revokes the
  invitation.
- One active (unrevoked) invitation per email. Inviting an address that has one returns
  the existing invitation unchanged with `created: false`. A pending invitation that has
  expired is revoked and replaced.
- `passwordSetup`: the invite link may also set a password for the address, once, while
  it has none (see [identity](identity.md#setting-a-password-from-the-link)). Honoured only
  for an admin or owner while a `password` entry is configured, and ignored otherwise.
  Whoever holds such a link can set the password, so send it privately.
- Revoking an accepted invitation that belongs to an owner needs the owner role
  (`403 OWNER_ONLY`).
- Inviting an address closes its open request to join, if it has one.

Nothing is emailed. Send each person their `link`, which opens the
[invite page](identity.md#invite-links) for that invitation. `signInUrl` is
`instance.baseUrl`. Audit actions: `invite.create` (with `via`: `console`, `project`,
`request` or `reinvite`, plus `from` for an invitation made again and `passwordSetup`),
`invite.link` (a new link), `invite.open` (the first sign-in started from a link),
`invite.wrong-account`, `invite.revoke` and `invite.accept` (with `via`: `sign-in`,
`join` or `link`).

## Invite links and access requests

Every pending invitation has a personal link, `<baseUrl>/l/invite/<token>`, and each project
on it has a link of its own. The token is signed with `LW_LINK_SECRET` (the previous key
still verifies during a rotation) over the invitation id, the project id (none for the
workspace link) and the invitation's link version. It is never stored. A token identifies an
invitation and never admits anyone: the person still signs in, with the invited address.
New link raises the version, so every earlier link stops working. See
[identity](identity.md#invite-links) for the pages and the sign-in they start.

**Pages and forms.** Server-rendered HTML in English, with no script.

| Route | Who | Notes |
|---|---|---|
| `GET /l/invite/:token` | public; reads the session cookie when there is one | the invite page. `200` while the invitation is pending or accepted, `410` once it has ended. Unknown, malformed, revoked and replaced tokens all get the same `410` "This link no longer works" page. Reading it changes nothing, so a chat preview or a mail scanner leaves no trace. `link` rate-limit bucket |
| `POST /api/auth/invite` | public; `join` needs a session | the invite page's forms: `token`, `csrf`, `action` (`start`, `password` or `join`), `idp` (for `start`) and `prompt` (`select_account`, optional). `start` records the first opening, then answers `302` to that IdP, or `200` with the email and password form. `password` answers `200` with the set-password form when this invitation may set one, else the invite page again with an error line. `join` accepts the invitation for a signed-in account that holds the address and answers `303` to the project, or `200` with the wrong-account page. A dead or ended token gets its `410` page. `auth` rate-limit bucket |
| `POST /api/auth/request` | public, with a valid `ask` token | the forms on the refusal and wrong-account pages: `ask`, `csrf`, `action` (`join`, `switch` or `withdraw`) and `note` (optional, at most 280 characters). `200` "Request sent" whether the request was created, was already open or was held by a cap; `withdraw` answers "Request withdrawn". An expired `ask` token or form is a `403` "This page expired" page. `auth` rate-limit bucket |

Every form carries the `lw_form` double-submit nonce (a cookie on `Path=/api/auth`) and
passes the Origin check. The pages are sent with `cache-control: no-store`,
`x-content-type-options: nosniff`, `referrer-policy: strict-origin`,
`x-robots-tag: noindex, nofollow` and
`content-security-policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'`.
The `ask` token is minted only on a page the server renders right after it verified a
sign-in (the refusal and wrong-account pages). It lives 30 minutes, travels in a hidden
form field, and carries the verified address, so the address on a request is never typed.

**Requests.** JSON routes with the session cookie. Service tokens are refused.

| Route | Who | Notes |
|---|---|---|
| `POST /api/v1/projects/:id/access-requests` | member (no guest) | Ask for access, or Ask to edit: body `{ role: "viewer" \| "editor", note? }`. Always `202 { "ok": true }`: an unknown or archived project, access the caller already has, a request already open and requests switched off all get the same answer, so filing reveals nothing. A note over 280 characters is `400 INVALID_INPUT`. After 20 requests in a day, `429 RATE_LIMITED` with `Retry-After` |
| `POST /api/v1/sessions/:id/access-requests` | member (no guest) | the same for a session link: the server finds the session's project and records the session the request came from. Shares the daily quota |
| `GET /api/v1/access-requests/mine?projectId=…` or `?sessionId=…` | member | `{ requests: MyRequest[] }`: the caller's own requests for that target, open or answered in the last 30 days, newest first |
| `POST /api/v1/access-requests/:id/withdraw` | the requester | body `{}`; `200 { request: MyRequest }`, or `404` for anyone else |
| `GET /api/v1/access-requests?status=open\|answered&since=…` | member | `{ requests: RequestView[] }`: the requests the caller may answer now, and nothing for someone who answers none |
| `POST /api/v1/access-requests/:id/approve` | an approver, checked again now | body `{ role? }` (project requests; the role asked for when absent). `200 { request, outcome, invitation?, link?, message? }`, with `outcome` one of `added`, `already`, `invited` or `moved`. `message.text` is a ready-to-send line for an approved join, for example "You can now sign in to lolly.ing. Open https://lolly.ing and sign in as sam.k@gmail.com with GitHub." |
| `POST /api/v1/access-requests/:id/decline` | an approver | body `{}`; `200 { request }` |

```ts
type MyRequest = { id, status, role, createdAt, answeredAt, answerRole };
type RequestView = {
  id, kind: 'project' | 'join' | 'switch',
  status: 'open' | 'approved' | 'declined' | 'withdrawn' | 'superseded' | 'expired',
  email, name, provider,     // provider: the display name of the sign-in that proved the address
  note, role, currentRole,   // currentRole: the requester's access when they asked
  project: { id, name } | null, session: { id, name } | null,
  invitation: { id, maskedEmail, inviter } | null,   // switch requests only
  createdAt, expiresAt, answeredAt, answeredBy: { name } | null, answerRole,
};
```

Who may answer, what each approval does, and how requests close are in
[sharing](sharing.md#asking-for-access) and [identity](identity.md#asking-to-join). An
approver is checked again on every list, approve and decline, against the project stored on
the request, never an id the client sends. Exactly one answer wins: approve claims the
request first, then acts. If the action then fails on a database error, the answer is
`500`, the request stays approved, the audit row records `effect: "failed"`, and a manager
adds the person by hand.

| Code | Status | Meaning |
|---|---|---|
| `ALREADY_ANSWERED` | 409 | someone answered first; the body's `request` says who and how |
| `FORBIDDEN` | 403 | the caller may not answer this request now, for example a manager since demoted |
| `REQUESTER_UNAVAILABLE` | 409 | the requester's account is disabled; the request closes as `expired` |
| `PROJECT_ARCHIVED` | 409 | the project was archived; the request closes as `expired` |
| `INVITATION_ENDED` | 409 | a switch request whose invitation is no longer pending; the request closes as `expired` |

Audit actions: `access.request`, `access.request.held` (a cap held it; `reason`
`per-email`, `workspace-cap` or `per-invitation`), `access.approve`, `access.decline`,
`access.withdraw` and `access.supersede`, each with subject `request:<id>` (a held request
stores nothing, so its subject is `request`). A note is recorded only as its length
(`noteChars`), never its text, and no payload holds a token.

## Service tokens

| Route | Action | Notes |
|---|---|---|
| `POST /api/v1/tokens` | `token.manage` (**owner**) | mint; the secret (`lwt_…`) appears in this response and never again |
| `GET /api/v1/tokens` | `token.manage` (**owner**) | list with last-used and revocation state - never secrets |
| `DELETE /api/v1/tokens/:id` | `token.manage` (**owner**) | revoke; the very next use gets `401` |

A minted token rides `Authorization: Bearer lwt_…` and resolves to a synthetic
principal carrying the token's role (no groups) - RBAC, grants and audit see it
like any member (`user:svc_<id>` actor). It works on the **action-gated**
surface (fleet, providers, governance export/apply, audit, telemetry summary);
approvals, submit and collab refuse it - those flows mean "a person decided".
See [identity](identity.md#service-tokens).

## SCIM provisioning

Admin (cookie, owner-only) mints the bearer; the protocol half is what the IdP calls with the bearer.
See [identity](identity.md#scim-provisioning).

| Route | Auth |
|---|---|
| `POST/GET /api/v1/scim/tokens`, `DELETE /api/v1/scim/tokens/:id` | `scim.manage` (owner) |
| `GET /scim/v2/ServiceProviderConfig` | SCIM bearer |
| `GET/POST /scim/v2/Users`, `GET/PATCH/DELETE /scim/v2/Users/:id` | SCIM bearer |
| `GET/POST /scim/v2/Groups`, `GET/PATCH/DELETE /scim/v2/Groups/:name` | SCIM bearer |

`GET /scim/v2/Users?filter=userName eq "…"` (and `externalId eq "…"`) is the existence check
an IdP runs before create. `active=false` on a User `PATCH` (or a `DELETE`) deprovisions:
disable + session-epoch bump. Group membership maps to each user's local groups.

## Approvals and inbox

| Route | Action |
|---|---|
| `GET/POST /api/v1/approvals` | member |
| `GET /api/v1/approvals/approvers` | member |
| `POST /api/v1/approvals/:id/act` | `approval.act` |
| `POST /api/v1/approvals/:id/withdraw` | member (submitter) |
| `GET /api/v1/inbox` | member - `{ messages, unread }` with `ETag: "ib-<16 hex>"` and `cache-control: private, no-cache`; a matching `If-None-Match` answers `304`, so a shell can check often for one header. `messages` holds the caller's messages and comment notices; `unread` counts both, and the tag moves when either changes |
| `POST /api/v1/inbox/:id/ack` | member - dismisses the message for the caller. For a comment notice (`cn_…`) it deletes the caller's own notice row and nothing else, so the next reply in that thread shows a notice again |
| `GET/POST /api/v1/messages` | `message.send` |

Message targeting is groups × shell selectors × engine-version range. Besides the
console's messages, the server writes `approval`, `expiry`, `collab` and `share`
messages, `request` (someone asks for access and you may answer) and `notice` (an
answer to your request, an accepted invitation, a welcome, an invitation entry that no
longer works). `data.kind` identifies which, and `data.at` is when it happened; the kinds
are listed in [sharing](sharing.md#notices).

The inbox hides a message whose subject the caller can no longer reach: a project share
or a live-collab invite once they cannot see the project, an invite also once its session
is deleted, and an access request for a project once they no longer manage the project. Hidden is
not deleted: the message comes back if the access does.

Comment notices (plan 76 milestone 4) appear in the same list. There is one per person
per thread, updated as replies arrive, and it is built when the inbox is read:

```json
{ "id": "cn_<24 hex>", "kind": "comment", "severity": "info",
  "title": "Ana mentioned you in Spring poster",
  "body": "<the first 140 characters of the newest message someone else wrote and nobody deleted>",
  "cta": { "label": "Open thread", "url": "<appUrl>/#/team/<sessionId>?thread=<threadId>" },
  "data": { "kind": "comment-mention", "sessionId": "...", "projectId": "...", "threadId": "...",
            "actorName": "Ana", "label": "Spring poster", "count": "1", "at": "<iso>" },
  "dismissible": true }
```

`data.kind` is `comment-mention` or `comment-reply`. A reply notice that counts several
replies is titled "New replies in Spring poster: 3". `actorName` is the person's name,
never an address, and `Member` when the account is gone. With no message by someone else
left, `body` is "This comment is no longer available." `appUrl` is `instance.appUrl`, or
empty when the app is served from this origin. The text is English; a client should build
its own title from `data` and its own link from `data.sessionId` and `data.threadId`.

Each notice is checked again on every read with the rule the comments routes use: the
caller can still open the session, `session.view` and `comment.view` hold, and
`policy.comments.enabled` and `policy.comments.notices` are not `false`. A notice that
fails a grant or the policy is hidden and kept until it is 30 days old; after that the
next read of the inbox (or of org-config) removes it, as does the next notice written for
the person. One whose session is deleted, or whose project the caller can no longer reach,
is deleted. Notices
are never emailed today; see `policy.comments` under [Canvas comments](#canvas-comments).

## Links and rendering

| Route | Action |
|---|---|
| `POST /api/v1/links` | `link.create` (`link.create-guest` for `guest-edit`) |
| `GET /api/v1/links[?all=1]` | member (own links; `all=1` needs the admin view) |
| `POST /api/v1/links/:id/revoke` | own link, or `link.revoke` |
| `GET /l/:id?s=…[&pw=…][&name=…]` | public (the signature *is* the authorization) |
| `GET /l/:id?s=…&zip=1`, `…&asset=<id>[&dl=1]` | public - a collection link's zip-all, and one member of that set (an id it does not name is `404 NOT_IN_COLLECTION`) |
| `GET /render/<toolId>.<format>` | `export.server`, or a guest scoped to that tool |

For worker-backed renders, asset inputs use the same URL encoding as the Lolly
shell. A `user/team/<fileId>` reference is resolved to that project's file endpoint
only when the submitter can read the project and the file belongs to the render's
scoped read ticket. The worker receives no general session credentials. Private
files outside that scope remain inaccessible; inline baked assets keep their
original bytes.

## Recoverable render resources

`POST /api/v1/renders` submits an authenticated, persistent single-tool request.
List/get its state, retrieve its verified output, cancel it, or create a retry
resource through the same API. The standalone server recovers expired leases;
function-only hosts refuse new submissions. See [Recoverable renders](renders.md)
for the request contract, routes, limits and deployment requirements.

New durable outputs expose a partial execution receipt at
`GET /api/v1/renders/:id/evidence`. It records loaded source hashes, prepared
context, observed asset byte digests and the output digest under the same lease.
The receipt describes its coverage gaps; it is not a complete dependency lock.

Render and batch requests accept `verification: "output-v1"`, or
`verification: { profile: "output-v1", widthPx: 1200, heightPx: 630 }`.
These assertions require final-file readback before publication. Failed required
checks retain `error.inspection` and publish no output. The [verification profile](renders.md#verify-the-produced-file)
lists supported formats and measurement limits; this is not design approval.

`POST /api/v1/render-batches` creates a parent and up to 200 independent child
renders atomically. Read its ordered rows and output receipts, download a JSON
manifest, cancel unfinished rows or retry a terminal batch while retaining its
successful children. The [batch API](renders.md#batches-with-durable-rows) is
separate from the existing `/api/v1/batch` job/ZIP contract.

## Projects and sessions

| Route | Action |
|---|---|
| `GET /api/v1/projects` | member: every project they can open (admins all), including projects shared with everyone on the instance. Archived projects are left out unless you pass `?archived=1`. Rows carry `myRole`, `updatedAt`, `updatedByName`, `via` (why they can open it: `owner`, `member`, `group`, `custom-group`, `everyone` or `admin`), `audience` (`restricted` or `instance`), and their own `listed` (`pinned` or `hidden`) and `lastOpenedAt`. A shell lists a project as the person's own when `via` is a relationship, or when they pinned it or opened it recently and did not hide it; the rest is found by browsing |
| `POST /api/v1/projects/:id/opened` | viewer - records that the caller opened the project, for their own recent list; `200 { lastOpenedAt, listed? }`. Visible to nobody else and never used for who viewed what |
| `PUT /api/v1/projects/:id/listing` | viewer - body `{ listed: "pinned" \| "hidden" \| null }`: keep the project in the caller's own list, keep it out, or follow the default |
| `POST /api/v1/projects` | `project.create` |
| `PATCH /api/v1/projects/:id` | manager of the project or `project.manage` - name, visibility, archive; `ownerId` (transfer to an enabled member; audited `project.transfer`) needs the owner or `project.manage`, and keeps the previous owner on the project as a manager (audited `project.member.add` with `via: 'transfer'`) unless their account is disabled. A directory group taken out of `visibility` loses its sharing role too, so adding it back starts at editor |
| `GET /api/v1/projects/:id/folders` | viewer; `{ folders: [{ id, projectId, parentId, name, createdAt, createdBy, items: [{ kind, ref }] }] }` |
| `POST /api/v1/projects/:id/folders` | editor and `session.edit`, project not archived; `{ name, parentId? }`; `201 { folder }`. An omitted or null parent creates a folder at the project root |
| `PATCH /api/v1/projects/:id/folders/:folderId` | editor and `session.edit`; `{ name }` renames a folder |
| `PUT /api/v1/projects/:id/folders/items/:kind/:ref` | editor and `session.edit`; `{ folderId }` moves a session or finished file into a folder in this project. Null returns it to the project root. Changes no document content or file bytes |
| `GET/POST /api/v1/projects/:id/sessions` | viewer / editor and `session.create`. List rows carry `updatedByName` |
| `GET /api/v1/sessions/:id`, `GET …/revisions` | viewer. The full session carries `myRole`, the caller's effective project role; workspace capabilities still apply |
| `PUT /api/v1/sessions/:id` | editor and `session.edit`. Session bodies (this and the `POST` above) may be up to 4 MiB; other routes take 512 KiB |
| `DELETE /api/v1/sessions/:id` | `session.delete`, editor, and the caller must be the session's creator or a manager of the project (its owner, a manager member, or a holder of `project.manage`; admins and owners hold it by default and a deny grant applies to them too) |
| `GET /api/v1/projects/:id/members` | viewer - `{ myRole, canTransfer, members: [{ userId, name, email?, role, via, addedAt, isMe? }], effective?, effectiveTruncated?, adminAccess?, invitations?, requests? }`; `email`, `effective`, `adminAccess`, `invitations` and `requests` for managers only; `isMe: true` marks the caller's own row. `via` is `owner` or `member`. `canTransfer` says whether the caller may hand the project on, by the test `PATCH` applies to `ownerId`. `effective` lists the people who can open the project without a row on it: `[{ userId, name, role, via: group \| admin, group?, isMe? }]`, no email, disabled accounts left out, sorted by name and capped at 200 (`effectiveTruncated: true`). Group rows cover only the groups the caller is in, unless the caller is an admin or owner. `adminAccess` is `listed` for an admin or owner caller, who also gets the `admin` rows, and `note` for any other manager, who gets no `admin` rows and sees group rows at the level the group gives; see [permissions](permissions.md#who-can-see-who-has-access). `invitations` lists the pending invitations that carry the project and those that expired in the last 30 days: `{ id, email, role, createdAt, expiresAt?, status: pending \| expired, openedAt?, invitedByName?, passwordSetup, link? }`, where `link` is the invite link for this project's entry, while pending. `requests` lists the open requests for the project: `{ id, userId, name, email, role, currentRole, note?, createdAt, viaSession?: { id, name } }` |
| `POST /api/v1/projects/:id/invite` | manager - body `{ emails, role, passwordSetup? }`; `200 { results: [{ email, status: added \| invited \| already \| refused, reason?, invitationId?, link?, expiresAt? }], link, message }`. A result's `link` is that address's own invite link for this project; the top-level `link` is `<appUrl or baseUrl>/#/team/project/<id>`. `message: { workspace, inviter, providers, note? }` is what Lolly needs to compose an invite message. `passwordSetup` is honoured only for an admin or owner with `user.invite` while a `password` entry is configured. New addresses follow `policy.invites`. A caller without `user.invite` may send 100 addresses an hour (`429 RATE_LIMITED`). Reasons are listed in [sharing](sharing.md#inviting-people) |
| `PATCH /api/v1/projects/:id/members/:userId` | manager - body `{ role }`; `409` for the owner |
| `PUT /api/v1/projects/:id/members/:userId/expiry` | manager - body `{ expiresAt }`, an ISO time in the future or `null` to clear; within `policy.sharing.maxGrantDays`. A membership past its end date gives no access and stays listed so it can be extended; sharing with the person again, an accepted invitation or an approved request also restores it, with no end date. Editors who may share cannot set end dates: an end date a minute away is a removal, and removal is for managers. `409` for the owner |
| `GET /api/v1/projects/:id/sharing` | viewer - `{ general: { audience: restricted \| instance, role }, grants: [{ principal: { kind: group, name } \| { kind: custom-group, id, name, memberCount }, role, expiresAt? }], expiries, settings: { viewersCanComment, viewersCanExport, editorsCanShare }, policy: { audiences, instanceMaxRole, roles, customGroups, maxGrantDays? }, canManage }`. `expiries` maps member ids to end dates, for managers only. `viewersCanComment: false` stops viewers creating comments and replies (`403`). `viewersCanExport` is advice to shells only: a viewer can render on their own device, so the server cannot enforce that restriction. Read by `@lolly-tools/core/sharing-v1` `readShareState` |
| `PUT /api/v1/projects/:id/sharing` | manager, or an editor when `settings.editorsCanShare` is on - any of `{ general, grants, settings }`. `grants` replaces every group grant; a directory group leaves the project's visibility when it leaves `grants`. Only a manager gives or takes manager access or changes `editorsCanShare`. `403 AUDIENCE_NOT_ALLOWED` / `ROLE_NOT_ALLOWED` / `GROUPS_OFF` follow `policy.sharing` and `policy.invites.projectRoles`; audited `project.sharing` |
| `GET /api/v1/share-groups` | member - the groups the caller owns, manages or belongs to: `{ groups: [{ id, name, description?, memberCount, myRole: owner \| manager \| member }], enabled }` |
| `POST /api/v1/share-groups` | `group.create` - body `{ name, description?, add?: [userId \| email] }`; the caller becomes the owner. People must be ones the caller already shares a project or group with, or an exact address of an enabled member. At most 100 owned groups and 500 people a group |
| `GET /api/v1/share-groups/people?q=…` | member of the instance (not a guest or a service token), while `policy.sharing.customGroups` is on (`403 GROUPS_OFF`) - suggestions for adding people: `{ people: [{ id, name }], truncated }`, drawn only from the caller's projects and groups (an exact address also matches). Never carries an address. At most 60 lookups a minute per person (`429 RATE_LIMITED`) |
| `GET/PATCH/DELETE /api/v1/share-groups/:id` | members read `{ …summary, members: [{ id, name, role }] }`; the owner and managers `PATCH { name?, description?, add?, remove? }`, the owner also `{ managers }`, and any member may `PATCH { remove: [own id] }` to leave; the owner or an admin deletes. Audited `share-group.*` |
| `DELETE /api/v1/projects/:id/members/:userId` | manager, or the member themselves; `204` |
| `DELETE /api/v1/projects/:id/invitations/:invitationId` | manager - takes the project off the invitation; a project-made invitation (`createdVia: "project"`) left with no project is revoked, a console invitation never is; `204` |
| `POST /api/v1/projects/:id/invitations/:invitationId/link` | manager, for an invitation that carries this project - New link: `200 { link, expiresAt }`. Every earlier link for the invitation stops working, the console's included. 10 a day per invitation, then `429 RATE_LIMITED` |
| `POST /api/v1/projects/:id/invitations/:invitationId/reinvite` | manager who may invite new people - Invite again, for an expired entry: `200` with one result row, the same shape as `invite`. Counts toward the hourly invite quota |
| `POST /api/v1/projects/:id/access-requests` | member - Ask for access or Ask to edit; see [access requests](#invite-links-and-access-requests) |
| `POST /api/v1/sessions/bulk` | `session.edit` and `project.manage`; only sessions in projects where the caller is an editor |
| `GET /api/v1/collab/invitees?sessionId=…&q=…` | member with read access to the session |
| `POST /api/v1/collab/invites` | `collab.edit` (= `session.edit`) |
| `GET /api/v1/collab/rooms` | `telemetry.view` - live room census for the console |
| `GET/POST /api/v1/collab/nearby` | `collab.join` - the nearby-discovery handover lane |

Roles on a project (viewer, commenter, editor, manager, owner) are described in
[sharing](sharing.md#people-and-roles). A commenter reads and comments like a viewer and
never changes artwork. A viewer or commenter asked to write gets `403 READ_ONLY`;
someone who cannot see the project gets `403 FORBIDDEN`.

**Session writes are compare-and-set, never last-writer-wins.** `PUT` requires the `rev`
you read; a stale `rev` answers `409 CONFLICT` with the **full current server session** in
`current`, the client keeps the local edit and rebases - nothing is silently
overwritten. `bulk` applies per-session CAS over a matched snapshot: a session someone
edited between preview and apply is **skipped, not stomped**, and reported as
`skipped: [{ sessionId, rev }]` in the response (re-run to retry). Every refused write is
audited as `session.conflict` (ids and revs only - never input values) and folded into
`GET /api/v1/stats/overview`'s `sessions.conflicts30d`.

While a live collab room holds a session, no `rev` can be written: `PUT` and `DELETE`
answer `409 COLLAB_ACTIVE` (no `current`, and not audited as a conflict), and `bulk` skips
the session with `reason: "collab-active"` in its `skipped` entry. Save again once the room
closes.

`invitees` autocompletes over **eligible principals only** - project membership
plus `collab.join`, never the directory, and the admin/owner "sees every
project" bypass does not make someone invitable. Prefix match on display name,
capped, self excluded, no email addresses: a person is named by first and last name, or
by the part of their address before the "@". `invites` enforces the same predicate
server-side and delivers through the inbox (`kind: "collab"`, `data.sessionId`
for the deep link); re-inviting refreshes the pending message instead of adding
a second.

### Project files

Files shared inside a project ([sharing](sharing.md#shared-files)). While
`sharing.projectFiles` in org-config is `false` (policy off, or the memory store), every
route here answers `404 NOT_FOUND` with the message `project files are off`.

| Route | Who | Answer |
|---|---|---|
| `GET /api/v1/projects/:id/files` | viewer | `200 { files, limits }` |
| `POST /api/v1/projects/:id/files` | editor and `session.create`, project not archived; a person, so a service token gets `403` | `201 { file, partBytes }`: the upload is reserved |
| `PUT /api/v1/projects/:id/files/:fileId/parts/:n` | the uploader | `204`; the body is part `n`'s bytes |
| `POST /api/v1/projects/:id/files/:fileId/finalize` | the uploader | `200 { file }` with `ready: true`; repeating it is harmless |
| `GET /api/v1/projects/:id/files/:fileId` | viewer | the bytes, as an attachment, `private, no-store` |
| `PATCH /api/v1/projects/:id/files/:fileId` | editor and `session.edit`, project not archived; a person, so a service token gets `403` | `200 { name }`; the body is `{ name }`, 1 to 200 characters with no control characters. The bytes, id and checksum do not change, so sessions that use the file keep working. `400 INVALID_INPUT` for a bad name, `403` without editor access, `404` for an unknown or unfinished file or a file in another project |
| `DELETE /api/v1/projects/:id/files/:fileId` | the uploader, or manager and up | `204`; on an unfinished upload this cancels it |

The begin body is `{ name, size, checksum, contentType, parts: [{ size, checksum }], asset }`,
where `checksum` is the hex SHA-256 of the whole file and of each part, every part but the
last is `partBytes` (1 MiB) long, and `asset` is the shell's own description of the file.
The instance keeps only `type` and `format` (up to 64 characters each), `width` and `height`
(numbers above zero) and `meta.name` (up to 200 characters) from `asset`, and drops anything
else, a credential included. `file` in the begin answer also carries `parts` and `expiresAt`.
`expiresAt` is 15 minutes after the begin; each accepted part moves it to 15 minutes after
that part, but never past `policy.projectFiles.uploadTtlHours` after the begin.

Each `files` row is `{ id, projectId, name, size, checksum, contentType, ready: true, asset,
createdAt, createdBy, createdByName? }`, newest first. Only finished files are listed.
`createdByName` never falls back to an email address. `limits` is `{ partBytes, maxBytes,
projectBudgetBytes, projectUsedBytes, instanceRemainingBytes }`, where the used and remaining
figures count finished files and unfinished uploads that have not expired, each at its size
plus 4096 bytes for its database rows.

| Code | Status | When |
|---|---|---|
| `PROJECT_FILE_TOO_LARGE` | 413 | begin: `size` is over `policy.projectFiles.maxFileBytes` |
| `PROJECT_FILE_BUDGET` | 413 | begin: the project's files would pass `projectBudgetBytes` |
| `INSTANCE_FILE_BUDGET` | 413 | begin: all projects' files would pass `instanceBudgetBytes` |
| `PROJECT_FILE_PENDING` | 413 | begin: the caller already has 16 unfinished uploads, or their declared sizes with this one would pass twice `maxFileBytes` |
| `INVALID_INPUT` / `INVALID_PART` | 400 | malformed metadata, or no such part |
| `CHECKSUM_MISMATCH` | 422 | a part, or the finished file, does not match its declared digest |
| `FILE_READY` | 409 | a part sent to a finished file |
| `UPLOAD_INCOMPLETE` | 409 | finalize before every part arrived |
| `UPLOAD_EXPIRED` | 410 | the upload passed its expiry (15 minutes without an accepted part, or `uploadTtlHours` after the begin) or was cancelled |
| `FILE_IN_USE` | 409 | delete of a file that live sessions in the project use; `sessions: [{ id, title }]` identifies them. A manager may add `?force=1` |
| `RATE_LIMITED` | 429 | download: this person already downloaded twice `instanceBudgetBytes` today, as counted by this server process; `retry-after` gives the seconds to wait |

Errors keep the usual `{ "error": { "code", "message" } }` shape. Finishing an upload is
audited as `project.file-upload`, a rename as `project.file-rename` (with the `fileId`), a delete
or cancel as `project.file-delete` (with `forced: true` and the session ids when `?force=1` was
needed). An unfinished upload more
than an hour past its expiry is removed, parts first, when someone next begins an upload (up to
50 at a time) and by `POST /api/v1/retention/run` (up to 500), whose answer then carries
`projectFilesSwept`. The long-lived server also sweeps them at boot and daily, whatever the
retention policy says. A serverless deploy has no timer, so there their parts stay in storage
until one of those runs; they count toward no budget meanwhile.

### The collab socket

Live co-editing runs over `GET /ws/collab/:sessionId`, a WebSocket upgrade
carrying the same session cookie an HTTP call would. Authorization happens
**before the handshake completes**, so a refusal is a plain HTTP status on the
socket rather than a mystery disconnect: `401` unauthenticated, `404` no such
session, `403` the project is not visible to you or `collab.join` is denied,
`410` the session is in the bin, `429` too many connections or reconnects, `503`
busy or shutting down. Write access is not a refusal: a member who may read but
not edit is seated as an **observer**.

One optional field rides the upgrade URL, and a client that omits it is
unaffected:

| Param | Meaning |
|---|---|
| `ds` | the brand profile the client is rendering with |
| `dsi` | the instance base that design system came from |

A room hosted here runs under exactly one design system, the one this deployment
governs (OSS `plans/186` section 3.10). When a client identifies one, `dsi` must be
this instance's `baseUrl` (a trailing slash and letter case are not a
difference, and the comparison is on the origin) and, on a profile-aware pack,
`ds` must be the **active** brand profile that `GET /api/v1/brand/profiles`
reports. A mismatch is refused `403 DESIGN_SYSTEM_MISMATCH`, whose body names
the design system to switch to. On a pack with no brand profiles there is
nothing to compare a name against, so only `dsi` is checked. Sending neither
param joins as before; sending one of the two checks only that one.

Clients can negotiate `interactionVersion: 1` in their join frame. Transform and
text claims belong to the live room, expire after ten seconds without renewal and
end on disconnect, demotion or object deletion. Acquisition covers all requested
objects atomically. Previews use document coordinates and never write the session.
Durable operations carry their claim ID; conflicting or expired claims are refused.

Canvas asset fields carry bounded `lolly-asset-v1:` references on the scalar lane.
These contain an asset ID, type, format, optional dimensions and an immutable project
file version; local URLs, file bytes and metadata do not travel in room operations.
The session projection stores ordinary asset reference objects so project file usage,
reopening and export retain their existing behavior. The shell uploads a device image
before sending its reference and restores project bytes before painting a received image.
The interaction-v1 shell understands these references. Older members receive ordinary
fields and retain their already-restored images; extension strings are omitted from
their operations and checkpoints. Live delivery of a newly added image needs the current shell.
Clients that do not negotiate this version continue to use the existing protocol.

### Canvas comments

Comments survive after the live room closes and have their own revisions. Every
request requires a signed-in person (a service token gets `401`), current session read
access (`404`, `403`, `410` as for the session) and `session.view` plus `comment.view`
over the session (`403`). That one rule also decides who gets comment notices in the
inbox and who gets live comment events. `policy.comments.enabled: false` disables review
on the instance.

| Route | Result |
|---|---|
| `GET /api/v1/sessions/:id/comments` | `{ enabled, permissions, threads, reads, readFloor, notices, features }`, below. `ETag: "cm-<24 hex>"` and `cache-control: private, no-store`; a matching `If-None-Match` answers `304` |
| `GET /api/v1/sessions/:id/comments/:threadId` | `{ thread, readAt? }`, one thread, for a client that heard a live event. `404` when the thread is not in this session |
| `POST /api/v1/sessions/:id/comments` | Create a thread using `id`, `messageId`, `anchor`, `body` and optional `mentions`; `201 { thread, notified }` |
| `POST /api/v1/sessions/:id/comments/:threadId` | `reply`, `edit`, `delete`, `resolve` or `reopen`, with the current thread `revision`; `reply` and `edit` take optional `mentions`; `200 { thread, notified }` |
| `POST /api/v1/sessions/:id/comment-reads` | Mark threads read for the caller: `{ threadIds?, at? }`, at most 100 ids, every thread in the session when `threadIds` is absent, `at` an ISO time (now by default, never later than now). Deletes the caller's notices for those threads. `200 { readAt, count }`; `404` when an id is not a thread in this session |
| `GET /api/v1/sessions/:id/comment-people?q=` | Who the caller may mention: `200 { people: [{ id, name }], truncated }`, at most 20, prefix match on the name (`q` up to 64 characters), sorted, caller excluded, never an address. Only for someone who may comment here; `403` when commenting or mentions are off |

The listing's fields:

- `enabled`: false when comments are off for the instance; `threads` is then empty and
  `readFloor` is absent.
- `reads`: `{ threadId: iso }`, when the caller last read each thread. `readFloor`: when
  the caller first listed this session's comments; messages older than it count as read.
  A thread is unread when it has a message by someone else, not deleted, newer than its
  read time (or the floor), or when its id is in `notices`.
- `notices`: the ids of threads in this session for which the caller has an inbox notice.
- `features`: `{ mentions, reads: true, events, thread: true }`. `mentions` follows
  `policy.comments.mentions`. `events` is true where live comment events run (the
  long-lived server); a client then polls less often. It is false on a serverless deploy.

Read state is private to each person: no route reads or changes anyone else's, and a
thread from another session is `404` on every route that identifies one.

**Mentions.** `mentions` is a list of at most 10 person ids (`400 INVALID_INPUT`
otherwise). The server keeps only the people who can open the session and read its
comments (an owner, an explicit member or a member of one of the project's groups, not
disabled, with `collab.join`, `session.view` and `comment.view`), never the writer and never a service
account, and stores each as `{ id, name }` with the name from its own records. A mention
never grants access. An edit without `mentions` keeps the earlier mentions whose `@Name`
is still in the text. Each person is told about a message once, however often an edit
removes and adds them again. Someone who was not told (over a limit below, or a failure)
is told by a later edit that still mentions them.

**Notices.** After a write is saved, the people it concerns get an inbox notice: the
people mentioned, and for a reply the thread's author and everyone who wrote a message in
it that is not deleted, never the writer. Resolving, reopening and deleting tell nobody.
At most 50 people per message, and one writer causes at most 120 notices in 10 minutes.
`notified` is false when someone who should have been told was not (over either limit,
someone mentioned while notices are off, or a failure, which is audited as
`comment.notice.failed`); the comment itself is saved either way. See
[the inbox](#approvals-and-inbox) for how a notice reads.

**Live events.** Where `features.events` is true, each saved create, reply, edit,
delete, resolve and reopen sends `{ "t": "comment", "threadId": "…", "revision": n }` on
the [collab socket](#the-collab-socket) to every seat of a person in the room who may
read comments, the writer's own tabs included. Guests and agents get none. The frame
carries no text; a client fetches the one thread.

**Limits.** Per person: comment writes (every create and every action) 30 a minute and
300 an hour; `comment-reads` 120 a minute; `comment-people` 60 a minute. Past a limit the
answer is `429 RATE_LIMITED` with `retry-after` in seconds (3600 when the hourly write
limit is the one reached, otherwise 60).

**Policy.** `policy.comments` takes `enabled` (default true), `mentions` (default true;
false stores no mentions and refuses `comment-people`), `notices` (default true; false
writes no notices and hides the existing ones) and `emailTitles` (default false). Mention
email is a seam that is off in this release. When it is switched on, a new mention is
mailed as "Ana mentioned you on <workspace>" with a link to the thread, never the comment
text, and identifies the document only with `emailTitles: true`. Replies are not mailed.

Viewers may comment when `comment.create` permits it, without gaining artwork
editing rights. People may edit or delete their own messages with `comment.edit`.
Editors with `comment.resolve` may resolve any thread; managers with
`comment.moderate` may delete other messages. Authors may resolve their own threads.
Archived projects permit reading only. Access removal takes effect on every request.

Point anchors contain `kind: "canvas"`, a surface ID and document-space `x`/`y`.
Object anchors contain `kind: "object"`, a collection, stable object ID, surface ID
and normalized `x`/`y` between zero and one. Deleting the object leaves its thread
findable; restoring that stable ID restores the pin. Creation requires a live object.
Retrying the same accepted thread or reply ID is idempotent, including after its
object is deleted. Conflicting IDs and stale revisions return `409`.

Limits are 100 threads per session, 50 messages per thread, 4,000 characters per
message and 64 KB per stored thread. Message bodies are plain text. Attribution and
timestamps come from the server; audit records contain identifiers, not message text.

### Session versions

Saved versions of a document (plan 76 milestone 4). What is kept, and for how long, is
in [data lifecycle](data-lifecycle.md#session-versions). Every route needs a signed-in
person (a service token gets `401`), current session read access (`404`, `403`, `410`
as for the session) and `session.view`. Saving and restoring also need editor access
and `session.edit` (`403 READ_ONLY`) and a project that is not archived
(`409 PROJECT_ARCHIVED`). Deleting needs a manager of the project (`403 FORBIDDEN`).

| Route | Result |
|---|---|
| `GET /api/v1/sessions/:id/versions?limit=&before=` | `200 { versions, before? }`, newest first. `limit` is 1 to 100 (30 by default); `before` is a version id to page on from, and the answer carries one when a full page came back. `cache-control: private, no-store` |
| `GET /api/v1/sessions/:id/versions/:versionId` | `200 { version }` with its `inputs` and `meta` |
| `POST /api/v1/sessions/:id/versions` | Save the document as it is stored now, with a name: `{ label, requestId }`, a label of 1 to 120 characters. `201 { version }`; the same `requestId` again answers `200` with the first version. Audited `session.version.save` |
| `POST /api/v1/sessions/:id/versions/:versionId/restore` | Restore it: `{ requestId }`. `200 { revision, live, restored, before, skipped, vetoed }`, below |
| `DELETE /api/v1/sessions/:id/versions/:versionId` | Delete it, with its restore pair. `200 { deleted: true }`. Audited `session.version.delete` |

A version is `{ id, sessionId, rev, kind, label?, contributors, createdBy?, createdByName?,
restoredFrom?, beforeId?, bytes, at }`. `kind` is `auto`, `close`, `save`, `named`,
`restore` or `before` (the document a restore replaced). `contributors` are
`{ id, kind, edits, name }` for the people and agents who edited since the version
before it; guests are counted together as one entry named "Guest". Names never carry
an email address.

**Restore.** On the long-lived server a restore goes through the document's live room,
which it opens when none is open, as one batch that everyone in the room receives, and
it needs `collab.join` (`403`). The restoring person's own write checks apply: an input
they may not change keeps its value and is named in `vetoed`, and an input the tool
does not declare, or of the wrong type, is named in `skipped`. On a serverless deploy
it is a compare-and-swap on the session row. Two versions record it, with the same
`requestId`: the `before` version, the document it replaced, which Undo restores, and
the `restore` version, the document it produced. In the answer, `before` is the id to
restore for Undo, `restored` is the restore version's id (or `null` when history had
no room for it), `revision` is the session's revision after it and `live` says whether
anyone else was in the room. The same `requestId` again answers with the first result.
Comments are never changed. The audit entry `session.restore` holds ids and counts.

Saves and restores share one limit per person: 10 a minute and 60 an hour
(`429 RATE_LIMITED`, `retry-after` in seconds).

| Code | Status | When |
|---|---|---|
| `VERSION_LIMIT` | 409 | a named save past 20 per person or 100 per document |
| `VERSION_SPACE` | 409 | a named save, or the `before` version of a restore, does not fit the space caps (100 MiB per document; `policy.versions.maxBytes` for the instance) |
| `RESTORE_INCOMPLETE` | 409 | the document cannot take every change of the version (a ceiling such as the number of objects); nothing was changed |
| `SESSION_CHANGED` | 409 | the document kept changing while restoring, or it is open on another server; try again |
| `NOT_FOUND` | 404 | the version is not one of this session's |
| `INVALID_INPUT` | 400 | a missing or malformed `label`, `requestId`, `limit` or `before` |

## Telemetry, activity, audit, fleet, system

| Route | Action |
|---|---|
| `POST /api/v1/telemetry` | member or guest session; attribution per level/consent |
| `POST /api/v1/telemetry/consent` | member |
| `GET /api/v1/telemetry/summary` | `telemetry.view` |
| `GET /api/v1/stats/overview` | `telemetry.view` |
| `GET /api/v1/stats/series?days=N` | `telemetry.view` - day-bucketed audit-action counts (counts only), the console's per-view activity headers; `days` clamps 7–90 |
| `GET /api/v1/activity` | `audit.export` |
| `GET /api/v1/audit?limit=&before=` (paged: the `limit` newest events, or those older than the `before` seq; `nextBefore` is the cursor while older rows exist), `GET /api/v1/audit/head` | `audit.export` |
| `GET /api/v1/fleet` | `fleet.view` - the version histogram, plus `engineVersion` (this deploy's vendored pin) |
| `GET /api/v1/fleet/installs` | `fleet.view` - registered installs, newest activity first |
| `PATCH /api/v1/fleet/installs/:id` | `fleet.manage` - set or clear the operator name |
| `DELETE /api/v1/fleet/installs/:id` | `fleet.manage` - forget the row (bookkeeping; the device is untouched) |
| `GET /api/v1/system/setup` | `instance.config`: safe running checks, pack, store and schema |
| `GET /api/v1/system/setup/configuration` | `instance.config`: non-secret settings, callback, environment presence and retained account/test evidence |
| `POST /api/v1/system/setup/configuration` | `instance.config`: validate a setup draft and return deployment/Helm files; never saves live deployment settings |
| `POST /api/v1/system/setup/identity-test` | `instance.config`: bounded installed-issuer discovery, audited result |
| `POST /api/v1/system/setup/account-test` | `instance.config`: exact `{sub}` lookup and retained SCIM/sign-in correlation; no email merge |
| `GET /api/v1/system/setup/tools/:id` | `instance.config` plus current tool use/export permission: sample input metadata and governed checked formats |
| `GET /api/v1/system/migrations` | `instance.config` (**owner**) |
| `GET /api/v1/docs`, `GET /api/v1/docs/:slug` | member - this documentation set |

## Static

| Route | Notes |
|---|---|
| `GET /admin`, `GET /admin/*` | the admin console (static; every call it makes is auth-enforced) |
| `GET /tools/*` | a tool's files (`tool.json`, `template.html`, `hooks.js`, ...) from the pack's `tools/<id>/`, never from the shell dist. Gated like `/catalog/*`, and a tool the caller's groups cannot see answers 404, the same absence the tool index shows. A guest may fetch the tool its link opens |
| `GET /`, `GET /*` | the Lolly web shell, when `instance.shellDir` is set. Registered last, so API/console/catalog/render/link routes always win; `api`, `catalog`, `tools`, `render`, `l`, `admin`, `healthz` are reserved prefixes |

## Common error codes

| Code | Status | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | no session, or this deployment is sign-in gated |
| `FORBIDDEN` | 403 | the required action is missing |
| `OWNER_ONLY_ACTION` | 403 | an owner-only escalation was attempted |
| `GUEST_LINKS_DISABLED` | 403 | guest links are off on this deployment |
| `BAD_SIGNATURE` | 403 | link signature invalid |
| `CONFIG_MANAGED` | 409 | the target is owned by `instance.json` |
| `CONFLICT` | 409 | stale session `rev` - the body's `current` is the server session to rebase on |
| `LINK_EXPIRED` / `LINK_REVOKED` | 410 | self-explanatory |
| `INPUT_LOCKED` | 422 | a locked input was supplied by the caller |
| `RATE_LIMITED` | 429 | too many requests of one kind from one person; `retry-after` gives the seconds to wait |
| `INVALID_INPUT` | 400 | an automation request is missing or has malformed required fields |
| `DOCUMENT_API_ERROR` | 400 | the requested compile/inspect/diff/measure/optimise/package operation could not be performed |
| `DATA_BINDING_ERROR` | 400 | a live JSON/CSV provider binding could not resolve, parse, query or validate |
| `ROW_VALIDATION_FAILED` | 422 | a batch row does not satisfy the selected tool contract |
| `IDEMPOTENCY_KEY_REUSED` | 409 | the principal reused an idempotency key for different request bytes |
| `UNSUPPORTED_FORMAT` | 400 | a format this deployment cannot produce (org_config's `render.formats` identifies what it can) |
| `FORMAT_NOT_ALLOWED` | 403 | the format exists here but this tool's overlay policy excludes it |
| `RENDER_BUSY` | 503 | the render worker is at capacity - retry after `Retry-After` seconds |
| `HOOKED_TOOL_NEEDS_CHROMIUM` | 501 | hooked tool, no worker configured (org_config's `render.hookedTools` is `false`) |
| `TOOL_REQUIRES_UNMET` | 501 | the manifest's `requires` identifies a `host.*` API the in-process render host lacks (`text`, `compose`, `audio`, the device APIs); route the tool through the Chromium worker |

## Client identification

Shells send `X-Lolly-Client` (shell, shell version, engine, platform). It feeds the fleet
histogram and message targeting; it is never trusted for authorization. The OSS shells add
an `install/<id>` token while - and only while - their person is signed in: on a request
that carries a live member session, it registers the install in the fleet registry.
Anonymous and guest traffic with the same token feeds the histogram and nothing else, and
there is no heartbeat: an install is seen exactly when its person uses the instance, and
leaving the instance client-side deletes the id.
# Automation and document API

The typed automation surface mirrors the open-source engine's document verbs:
`POST /api/v1/compile`, `/validate`, `/inspect`, `/diff`, `/measure`, `/optimize`,
`/package`, and `/render`; `GET /api/v1/schema/:toolId` publishes a tool's input
schema. JSON requests use `{toolId, inputs}` rather than URL-only merge fields.
Schema, compile, package and render all enforce the caller's `tool.use` decision
and tool-visibility overlay; a document verb cannot be used to discover a tool
hidden from that principal. Render additionally requires `export.server`.

Pass `?async=1` or `Prefer: respond-async` to receive `202 {jobId,statusUrl}`.
Poll `GET /api/v1/jobs/:id`, download a completed result from
`GET /api/v1/jobs/:id/result`, or list the caller's jobs at `GET /api/v1/jobs`.
Completed job resources include `resultSha256`, computed from the output bytes rather than blob
provider metadata; it is `null` until a result exists.
`DELETE /api/v1/jobs/:id` removes queued work or retained output, except while a delivery
retains that output (`409 JOB_OUTPUT_IN_USE`). Jobs are isolated to the member or service
principal that created them. A completed render can be delivered without a download/upload
round trip through `POST /api/v1/jobs/:id/deliveries`; the delivery shares the immutable result
blob and records the source job id. Repeating a
request with the same `Idempotency-Key` returns its existing job; reusing that
key for different request bytes returns `409 IDEMPOTENCY_KEY_REUSED`. A
`callbackUrl` is used only when it exactly matches the instance-configured
webhook endpoint; callback requests carry `x-lolly-timestamp` and a signed
`x-lolly-signature` header. Their absolute result URL carries its own 24-hour
signature, so the receiver does not need the caller's session cookie.

`POST /api/v1/batch {toolId,format,rows,keepGoing?,retries?,concurrency?,priority?}`
always creates a job and produces one ZIP. Requested concurrency is capped at
four in this process, priority at 0–9, and retries at three. Progress is exposed
as `{done,total}` and the ZIP's `manifest.json` records every row outcome. In
place of `rows`, `bind:{source,query?,as?}` reads JSON/CSV from a governed
provider; `as` may be the JSON Schema returned by the schema route, and every
row is also checked against the actual tool before enqueue. `query` is a typed,
nested equality selector: it is forwarded to the provider and enforced again
over the returned objects. CSV follows RFC 4180, including quoted commas,
escaped quotes and embedded newlines; its cell values are strings.

Provider refs are resolved during compile and before render cache identity.
Local `image://brand`, `catalog://`, and `library://` refs stay offline-first.
`cms://<provider-id>/<remote-id>` uses that enabled catalog provider's stored
credential, exposure and lifecycle; `net://<operator-allowed-origin>/<path>` is
restricted to origins present in provider configuration. Both are timeout- and
byte-bounded, content-addressed, and use immutable resize, format-conversion and
metadata-strip stages. `/inspect` and `/optimize` also accept `bytesBase64` or a
provider `source`; `/package` accepts either a compiled `document` or
`{toolId,inputs}` and can run asynchronously.

These routes use the configurable `rateLimit.automation` bucket. It is technical
admission control, not printer-rate pricing; durable per-principal quotas and
usage accounting are specified in plan 45.

Durable render and batch requests accept `production: { contract,
referenceBase64?, repair? }` for the engine's `lolly/production-still-v1` profile.
The `lolly/production-motion-v1` profile is not accepted by Work's render API.
The contract and repair choices are included in request identity and retries.
Contracts can protect runtime input identities with `kind: "input"`, a declared
input id in `location` and a canonical JSON SHA-256 in `expected`. Required input
checks need observed runtime values; file-only inspection cannot reconstruct them.
The retained evidence contains `production` and optional `productionAttempts`;
failed required checks return no artifact and retain `PRODUCTION_VERIFICATION_FAILED`
diagnostics on the render record. See [Production still checks](renders.md#production-still-checks-and-permitted-repairs)
for fields, collector limits and worker compatibility.

## Managed rule mappings

| Route | Action | Notes |
|---|---|---|
| `GET /api/v1/brand/rules` | `catalog.read` | Published guide and source-specific mappings; compatible input inventory is visible to policy editors |
| `POST /api/v1/brand/rules/preview` | `policy.edit` | Validate `{ mappings }`, inspect format coverage, return revision and review token |
| `POST /api/v1/brand/rules` | `policy.edit` | Apply the reviewed mappings with `revision` and `reviewToken`; audited, stale-safe and durable outside development |

See [managed production rules](design-system-administration.md#managed-production-rules) for scope and draft handling. Render input checks do not certify output appearance. Durable output metadata includes `brandRules` with disposition, scope and revision; synchronous and durable downloads expose `x-lolly-brand-check`.


### Project session presence

`GET /api/v1/projects/:id/presence` requires project viewer access and `session.view`.
It returns private, uncached live session participants: display names, assigned colours,
writer/observer roles and away state. Multiple tabs count as one person. Session deny
grants and deleted sessions are respected; cursor, chat and document fields are omitted.
Hosts without a collaboration gateway return `available: false`. Coverage is capped at
500 live sessions with an explicit `truncated` flag.

### Agent activity

`GET /api/v1/agents/activity?days=30` requires `audit.export`. `days` is an
integer from 1–90 (default 30). The private, no-store response includes summary
call/outcome/operation counts, the most recently observed agent invitations with
inviter, scope, role, expiry and live document-room presence, and a metadata-only
recent timeline. No credentials, arguments or document contents are returned.
`truncated` and `inventoryTruncated` explicitly disclose the 10,000-event and
500-agent coverage limits. Room presence is `null` when no room host is wired.
See [Document agents](document-agents.md#admin-visibility) for reporting semantics.

### Project agent invitations

Agent activity uses an `agent:<invitation id>` audit actor with the inviting user recorded separately as `invitedBy`. The activity API returns `actor.kind: "agent"` and, when known, `actor.invitedBy: { id, name }`. Filtering by a user or group includes their invited agents. See [Activity attribution](document-agents.md#activity-attribution).

These routes require a signed-in person with access to the project. They never return a stored connection key. See [Document and project agent invitations](document-agents.md) for the MCP tools and their scope.

| Route | Access and response |
|---|---|
| `GET /api/v1/projects/:id/agents` | viewer; `{ enabled, canInvite, canEdit, agents }`. Each row includes the inviter's display name, expiry, connection state and `canRevoke`; no key or hash |
| `POST /api/v1/projects/:id/agents` | viewer; `{ label, role, hours? }`, with viewer/editor access and 1 to 168 hours (default 24). Editor access also needs project editor rights. Refused on archived projects. `201 { agent, endpoint, secret }` returns the connection key once |
| `DELETE /api/v1/projects/:id/agents/:agentId` | inviter or project manager; revokes the key and closes its document connections; `204` |

Project keys authenticate only `POST /api/workspace/mcp`, using `Authorization: Bearer <key>`. They do not authenticate the REST API. `DELETE /api/workspace/mcp` disconnects document connections without revoking the key. MCP requests recheck current inviter access. Project tools accept only their declared arguments and never a caller-selected project or HTTP path. Tool failures return `isError: true` with a safe error code and explanation. Document tools require `sessionId` for a project key; a document key remains bound to its original document.
