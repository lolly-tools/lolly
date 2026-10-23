# Set up enterprise identity

This runbook is for the operator connecting Lolly Work to an organisation's identity
provider, with logout, optional assurance claims and machine credentials. Use it with
[Install](install.md) and [Operations](operations.md). What the settings mean for the people
signing in is on [Sign-in and sessions](identity.md).

Work owns organisation sign-in, admission and revocation. Serve the Lolly web shell and Work on
the same HTTPS origin. The optional Lolly Content Credentials CA has its own provider
registration and trust policy; a Work session does not sign a person into that CA.

::: timeline
- <!--i:server--> **Prepare the deployment.** Final address, secrets, database and network access.
- <!--i:link--> **Register the client.** Redirect, logout and scope settings at your provider.
- <!--i:sliders--> **Configure admission and assurance.** Who may sign in, and which claims a sign-in must carry.
- <!--i:checklist--> **Qualify before opening access.** Sign-in, sign-out, logout, disable and key rotation on a candidate.
- <!--i:wrench--> **Operate and upgrade.** Offboarding, migrations, rollback and monitoring.
:::

## 1. Prepare the deployment

Choose the final HTTPS `instance.baseUrl` before registering the client. Keep
`dev.enabled: false`, use PostgreSQL and store stable `LW_SESSION_SECRET`, `LW_LINK_SECRET`
and provider secrets in your secret manager. All replicas must use the same configuration,
secrets and database. Pin application and shell releases, keep the previous configuration, and
test database restoration. Follow the platform guide for TLS, proxy trust, storage and
backups.

Allow server egress to the configured issuer's discovery, token and JWKS endpoints:

- Discovery must return exactly the configured issuer, including any path or trailing slash.
- HTTPS is required outside loopback development.
- Redirects from these server requests are refused, so configure their final URLs.
- Requests have a ten-second timeout and a 1 MiB response limit.

Keep node clocks synchronized.

## 2. Register the client

Create an Authorization Code client with PKCE S256 and these exact URLs, replacing
`https://work.example.com` with `instance.baseUrl`:

| Registration | Value |
|---|---|
| Redirect URI | `https://work.example.com/api/auth/callback` |
| Post-logout redirect URI | `https://work.example.com/` |
| Back-channel logout URI, primary provider | `https://work.example.com/api/auth/backchannel-logout/primary` |
| Back-channel logout URI, additional provider | `https://work.example.com/api/auth/backchannel-logout/<id>` |
| Scopes | `openid profile email`, plus any provider scopes needed for groups |
| ID token algorithm | RS256 by default; ES256 or PS256 only with matching Work configuration |

Use a confidential client where possible. Match `tokenEndpointAuthMethod` to the
registration: `client_secret_basic`, `client_secret_post` or `none` for a public PKCE client.
The default is POST when a secret exists, otherwise `none`. If discovery advertises supported
methods, the configured method must be listed. Primary secrets use `LW_IDP_CLIENT_SECRET`;
additional providers point at their own environment variable with `clientSecretRef`. Each
provider's console steps are in the [provider recipes](identity-providers.md#provider-recipes).

For session-specific logout, request `backchannel_logout_session_required=true` and arrange
for **both ID tokens and logout tokens to contain `sid`**. The provider must reach the
back-channel route directly, without an interactive proxy login.

::: details How the back-channel route checks a logout
- It verifies signed logout tokens and needs no Work cookie.
- It shares the configurable per-IP `auth` rate-limit bucket with sign-in. Qualify provider
  retries for HTTP 429 and 503, and size that bucket for logout bursts.
- It accepts form-encoded POSTs, requires the logout event, issuer, audience, issue time and
  unique event ID, and refuses a nonce.
- Events older than five minutes, or more than one minute in the future, are refused.
- Subject-only logout is unsupported, because it would end other provider sessions for the
  same account.
:::

## 3. Configure admission and optional assurance

Merge this example into the instance configuration. Replace all sample values and keep the
installation's pack, shell, storage and deployment settings:

```json
{
  "instance": { "baseUrl": "https://work.example.com" },
  "dev": { "enabled": false },
  "idp": {
    "issuer": "https://id.example.com/realms/staff",
    "clientId": "lolly-work",
    "displayName": "Staff SSO",
    "tokenEndpointAuthMethod": "client_secret_basic",
    "signingAlgorithm": "RS256",
    "groupsClaim": "groups",
    "emailVerification": "claim",
    "admission": { "emails": ["operator@example.com"], "invitations": true },
    "bootstrapOwners": ["operator@example.com"],
    "linkedStandingDays": 30
  }
}
```

Map directory groups and `roleGroups` with care, and check that one operator can administer
the instance before you invite everyone. How admission, [verified
email](identity.md#verified-email) and [bootstrap owners](identity.md#bootstrap-owners) work
is on Sign-in and sessions.

Assurance is optional per OpenID Connect provider, including each `additional` entry. For
example, after checking your issuer's actual claim vocabulary:

```json
"assurance": {
  "acrValues": ["urn:example:assurance:mfa"],
  "amrValues": ["mfa"],
  "maxAgeSeconds": 3600
}
```

- `acrValues` accepts any one listed `acr`. `amrValues` requires every listed method in `amr`.
  These strings have issuer-specific meanings.
- `maxAgeSeconds` requires `auth_time` and allows up to sixty seconds of clock difference.
- Work sends `acr_values` and `max_age` and verifies the returned claims. Request hints alone
  do not enforce MFA.
- The policy governs that provider's new sign-ins. It does not impose MFA on other providers,
  password, proxy or passkey sign-ins, and it does not invalidate cookies already issued.
  Review those paths separately before claiming an organisation-wide MFA requirement.

Work requires signed `iss`, nonempty `sub`, `aud`, `exp` and `iat`, plus the transaction
nonce. The audience must include this client and no other audience unless it is listed in
`trustedAudiences`. When present, `azp` must equal this client. Leave extra audiences unset
unless the provider requires them and you have reviewed their trust boundary. Algorithms,
client authentication, audiences and assurance are not inherited by additional providers.

Validate the configuration before rolling out:

```sh
LW_CONFIG=./instance.json pnpm run check:setup
pnpm run migrate:status
```

For Helm, merge these keys under `config.idp` in your values and use the top-level
`existingSecret` for runtime secrets, keeping the installation's existing values and secret
references. Alternatively, pass the complete reviewed instance JSON with
`--set-file config=instance.json` on your usual Helm install or upgrade command. No separate
identity chart or source edit is needed.

## 4. Qualify before opening access

Use a candidate environment with the same ingress and provider policy as production:

1. Sign in as the operator and as a member. Check names, verified email, group-to-role mapping
   and access to the intended pack. Confirm that an uninvited identity is refused.
2. Test every provider and configured assurance failure, including missing claims. Confirm
   that a refused callback creates no usable session and that the audit trail explains the
   failure without recording tokens or secrets.
3. Use ordinary **Sign out**. Confirm that only the local browser leaves Work and that another
   application at the provider stays signed in.
4. Use **Sign out of identity provider** from the browser profile or console, and confirm the
   warning. Check provider sign-out and the registered return URL. Work sends `client_id` and
   a subject `logout_hint`; it does not keep an `id_token_hint`. Providers may prompt again or
   need a different logout integration. A provider without a discovered
   `end_session_endpoint` reports that sign-out is unavailable, and local sign-out still works.
   Native and device clients use the browser for provider sign-out.
5. Create two independent provider sessions for one person. Send a real logout event for one
   `sid`: only that session, and devices and renewals derived from it, should lose Work access.
   Repeat the event and check that it succeeds without duplicate audit rows. Test through each
   replica and the collaboration endpoint. This checks access on the next authenticated
   operation; it does not erase data already downloaded.
6. Disable the person through SCIM or the Work admin interface. Confirm that every sign-in and
   device loses access, including linked personal identities. Re-enable only once you have
   confirmed the person should regain access.
7. Rotate a provider signing key in the candidate. A new `kid` should trigger an early JWKS
   refresh. Keep the old public key while tokens signed with it can still be valid.

Automated tests cover protocol failures and durable logout. They do not replace these checks
against a real provider, network and secret manager.

## 5. Operate and upgrade

**Offboarding.** Keep `linkedStandingDays: 30`, and use SCIM or admin revocation as the
immediate control:

- Newly issued sessions that depend on another identity's groups or admission expire at that
  identity's standing deadline, even when their cookie would last longer. Signing in through a
  personal provider does not refresh work identity standing.
- Passkeys are independent local credentials with no linked-identity standing deadline and no
  provider `sid`. Their access continues until local session expiry or SCIM or admin
  suspension. Requiring periodic provider re-authentication for passkeys needs a separate
  policy change.
- Ordinary sign-out and a single `sid` logout do not suspend an account.
- Provision SCIM with the correct provider subject mapping (additional provider subjects use
  `<id>:<sub>`), following [SCIM provisioning](#scim-provisioning), and verify mappings before
  enabling automated deprovisioning.

**Release introducing logout.** Back up the database and keep the current image, configuration
and secret versions. Apply migration `0067_oidc_logout.sql` through the normal migration runner
before serving the new version. Helm's enabled migration Job handles this; an image-only update
helper does not run migrations. Outside that Job, run `pnpm run migrate` and then
`pnpm run migrate:status` against the intended database. The new tables store hashed event
and session identifiers for durable, atomic replay protection and revocation across replicas.
Event records expire after ten minutes and session targets after thirty-one days, covering the
thirty-day maximum session chain. Cleanup runs when a valid logout arrives. A newer token
issue time cannot revive a revoked `sid`.

Upgrade all replicas before depending on the new checks. Older cookies have no provider
session binding or standing deadline, so they cannot gain these protections through renewal.
Let them expire under the previous maximum lifetime, or revoke accounts' existing sessions and
require fresh sign-in for a bounded cutover. Deploy the updated Lolly shell to show the
provider sign-out action in Settings; the updated Work console offers the same action on its
own.

**Rollback.** Keep the new tables; do not automatically reverse database migrations. An older
server does not enforce the new logout records or standing deadlines. If you revert server
code, restrict access until you accept the security implications and existing sessions have
been revoked. Test the previous image against the migrated database in the candidate
environment before you need a rollback. Reverting an assurance setting affects future
sign-ins; it does not rebuild sessions that were refused.

**Secret and issuer changes.** Follow [secret rotation](operations.md) for Work's session and
link keys and their previous-key overlap. Rotate client credentials at the provider and in
the secret manager with provider-supported overlap, then roll all replicas and verify a new
sign-in. JWKS keys are fetched automatically and cached for ten minutes, with early refresh for
an unknown `kid`; replacing a key under the same `kid` may need that cache to expire. Issuer
URLs, client IDs and additional-provider IDs are identity boundaries: treat a change as a
migration with account and SCIM mapping checks, fresh sign-in and a recovery owner, not as a
routine secret rotation.

Monitor the `auth.failed`, `auth.denied`, `auth.logout-provider` and
`auth.backchannel-logout` audit actions and callback and logout HTTP errors. Liveness alone
does not show that discovery, credentials, claims or SCIM work.

## Machine credentials

Two kinds of standing bearer credential sign machines in: a SCIM token for your provider's
provisioning connector, and a service token for automation. Only an owner mints either
(`scim.manage` and `token.manage`). Each secret is shown once and stored as its SHA-256
hash, so a leaked database yields hashes, not usable tokens.

The console's **Provisioning and service tokens** page creates, lists and revokes both. A new
secret displays once and is cleared when acknowledged. It is never placed in the URL, browser
storage or token metadata, so record it before leaving. Last-use metadata helps identify unused
credentials.

### SCIM provisioning

Your provider can push joiners, movers and leavers over SCIM 2.0 at `/scim/v2`, so people are
provisioned without a console visit. Supported: Users (create, patch, `active=false`) and Group
membership. Passwords, bulk, sort and ETags are declared unsupported in
`GET /scim/v2/ServiceProviderConfig`.

SCIM is another writer of the one identity model, never a second one:

- A SCIM **User** is a Work account. Its `externalId` receives the configured connector
  subject prefix that OpenID Connect sign-in uses, so a person the provider provisions and the
  same person signing in resolve to **one account**. The groups SCIM set survive that sign-in,
  because they are stored as local groups (durable), not as provider groups (re-synced at each
  sign-in).
- A SCIM **Group** is a local group. Membership is stored per person, so a Group `PATCH`
  becomes a set of per-person edits to the same local groups the console writes.
- `active=false` is the deprovision. It disables the account **and** bumps the session epoch,
  exactly as the console's disable does, so every live session ends at once ([offboarding,
  disable and revocation](identity.md#offboarding-disable-and-revocation)).

The connector authenticates with a bearer token, one per provider:

```
POST   /api/v1/scim/tokens     { "idp": "keycloak" }   # returns the secret ONCE
GET    /api/v1/scim/tokens                              # metadata only - never the secret or its hash
DELETE /api/v1/scim/tokens/:id                          # revoke
```

- The connector id must be a configured OpenID Connect provider (`primary` or an additional
  provider id).
- Tokens expire after 90 days by default; `ttlDays` accepts a positive number up to 365.
- User and group reads and changes are limited to resources assigned to that connector. Owner
  and admin accounts, their role groups and groups with owner-only grants stay under instance
  administration.

On an existing installation, apply migration `0068_provisioning_scope.sql`, reissue
provisioning tokens, and assign the earlier resources through an owner session:

```
PUT /api/v1/scim/ownership
{ "idp": "primary", "userIds": ["<user id>"], "groups": ["<group name>"] }
```

Every member of an assigned group must be assigned to the same connector, and resources already
assigned to another connector cannot be reassigned by this route. Earlier tokens without an end
date, and resources without an assignment, stay unavailable to SCIM.

SAML is not implemented. A broker such as Keycloak bridges a SAML-only provider to the OpenID
Connect that Work already speaks ([SAML recipe](identity-providers.md#saml)).

### Service tokens

A service token gives automation an identity of its own: CI running `lw export` and `lw apply`,
a governance drift check or an audit poller, with no session cookies in secret stores.

```sh
lw tokens create --label ci --role admin --days 90
```

- A new token carries the role you choose and expires after 90 days by default; `ttlDays`
  accepts 1 to 365.
- Presenting it resolves to a synthetic principal with the token's role and no groups. The
  role evaluator, grants and the audit trail treat it exactly like a person, so there is no
  second authorization model.
- Tokens work on the action-gated API and are refused on the routes where a person decides:
  approvals, submissions and live editing.
- Authenticate the CLI with `LW_TOKEN=<token>` or `--token`, and revoke a token with one
  command.

Earlier tokens without an end date are still accepted for compatibility. The list reports
`legacyUnbounded` and `legacyUnboundedCount`, and the CLI labels them for rotation:

::: timeline
- <!--i:sparkle--> An owner issues a replacement token.
- <!--i:wrench--> Install it in the automation and verify its access.
- <!--i:trash--> Revoke the old token.
- <!--i:lock--> After every integration has rotated, an owner may set `policy.serviceTokens.allowLegacyUnbounded: false` to refuse any remaining unbounded tokens.
:::

No cutover date or automatic invalidation is set. Narrower token scopes are not built yet.
