# Enterprise identity deployment

Use this runbook with [Install](install.md) and [Operations](operations.md).
Work owns organisation sign-in, admission and revocation. Serve the Lolly web
shell and Work on the same HTTPS origin. The optional Lolly Content Credentials
CA has its own provider registration and trust policy; a Work session does not
sign a person into that CA.

## 1. Prepare the deployment

Choose the final HTTPS `instance.baseUrl` before registering the client. Keep
`dev.enabled: false`, use PostgreSQL, and store stable `LW_SESSION_SECRET`,
`LW_LINK_SECRET` and provider secrets in your secret manager. All replicas must
use the same configuration, secrets and database. Pin application and shell
releases, retain the previous configuration, and test database restoration.
Follow the platform guide for TLS, proxy trust, storage and backups.

Allow server egress to the configured issuer's discovery, token and JWKS
endpoints. Discovery must return exactly the configured issuer, including any
path or trailing slash. HTTPS is required outside loopback development. Redirects
from these server requests are refused; configure their final URLs. Requests have
a ten-second timeout and a 1 MiB response limit. Keep node clocks synchronized.

## 2. Register the client

Create an Authorization Code client with PKCE S256 and these exact URLs, replacing
`https://work.example.com` with `instance.baseUrl`:

| Registration | Value |
|---|---|
| Redirect URI | `https://work.example.com/api/auth/callback` |
| Post-logout redirect URI | `https://work.example.com/` |
| Back-channel logout URI, primary provider | `https://work.example.com/api/auth/backchannel-logout/primary` |
| Back-channel logout URI, additional provider | `https://work.example.com/api/auth/backchannel-logout/<id>` |
| Scopes | `openid profile email`, plus provider scopes needed for groups |
| ID token algorithm | RS256 by default; ES256 or PS256 only with matching Work configuration |

Use a confidential client where possible. Match `tokenEndpointAuthMethod` to the
registration: `client_secret_basic`, `client_secret_post`, or `none` for a public
PKCE client. The existing default is POST when a secret exists, otherwise `none`.
If discovery advertises supported methods, the configured method must be listed.
Primary secrets use `LW_IDP_CLIENT_SECRET`; additional providers name their own
environment variable in `clientSecretRef`.

For session-specific logout, request `backchannel_logout_session_required=true`
and arrange for **both ID tokens and logout tokens to contain `sid`**. The IdP
must reach the back-channel route directly without an interactive proxy login.
The route verifies signed logout tokens and does not need a Work cookie. It
shares the configurable per-IP `auth` rate-limit bucket with login. Qualify
provider retries for HTTP 429 and 503 and size that bucket for logout bursts. It
accepts form-encoded POSTs, requires the logout event, issuer, audience, issue time
and unique event ID, and refuses a nonce. Events older than five minutes or over
one minute in the future are refused. Subject-only logout is intentionally
unsupported: it would end other IdP sessions for the same account.

## 3. Configure admission and optional assurance

Merge this example into the instance configuration. Replace all sample values
and keep the installation's pack, shell, storage and deployment settings:

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

Map directory groups and `roleGroups` deliberately; verify one operator can
administer the instance before inviting everyone. Email admission normally needs
boolean `email_verified: true`. Tenant-managed providers that omit this claim
need an explicit reviewed `emailVerification: "trusted"` choice and the appropriate
`tenantId` or `hostedDomain` pin. See [provider recipes](identity.md#provider-recipes)
for the existing linking and admission rules.

Assurance is optional per OIDC provider, including each `additional` entry. For
example, after verifying your issuer's actual claim vocabulary:

```json
"assurance": {
  "acrValues": ["urn:example:assurance:mfa"],
  "amrValues": ["mfa"],
  "maxAgeSeconds": 3600
}
```

`acrValues` accepts any one listed `acr`; `amrValues` requires every listed
method in `amr`. These strings have issuer-specific meanings. `maxAgeSeconds`
requires `auth_time` and accepts up to sixty seconds of clock tolerance. Work
sends `acr_values` and `max_age` and verifies the returned claims. Request hints
alone do not enforce MFA. This policy governs that provider's new OIDC sign-ins;
it does not impose MFA on other providers, password, proxy or passkey sign-ins,
or invalidate cookies already issued. Review those paths separately before
claiming an organisation-wide MFA requirement.

Work requires signed `iss`, nonempty `sub`, `aud`, `exp` and `iat`, plus the
transaction nonce. The audience must include this client and contain no other
audience unless explicitly listed in `trustedAudiences`. When present, `azp`
must equal this client. Leave extra audiences unset unless the provider requires
them and their trust boundary has been reviewed. Algorithms, client auth,
audiences and assurance are not inherited by additional providers.

Validate configuration before rolling out:

```sh
LW_CONFIG=./instance.json pnpm run check:setup
pnpm run migrate:status
```

For Helm, merge these keys under `config.idp` in your values and use
the top-level `existingSecret` for runtime secrets. Keep the existing installation's
values and secret references. Alternatively, pass the complete reviewed instance JSON using
`--set-file config=instance.json` with your existing Helm install/upgrade command.
No separate IdP chart or source edit is required.

## 4. Qualify before opening access

Use a candidate environment with the same ingress and IdP policy as production:

1. Sign in as the operator and a member. Check names, verified email, group-to-role
   mapping and access to the intended pack. Confirm an uninvited identity is refused.
2. Test every provider and configured assurance failure, including missing claims.
   Confirm a refused callback creates no usable session and the audit trail explains
   the failure without recording tokens or secrets.
3. Use ordinary **Sign out**. Confirm only the local browser leaves Work and another
   application at the IdP stays signed in.
4. Use **Sign out of identity provider** from the browser profile or console and
   confirm the warning. Check IdP sign-out and the registered return URL. Work sends
   `client_id` and a subject `logout_hint`; it does not retain an `id_token_hint`.
   Providers may prompt again or require a different logout integration. A provider
   without a discovered `end_session_endpoint` reports that sign-out is unavailable;
   local sign-out remains usable. Qualify this with your provider before advertising
   the action. Native/device clients use the browser for provider sign-out.
5. Create two independent IdP sessions for one person. Send a real logout event for
   one `sid`; only that session and devices/renewals derived from it should lose Work
   access. Repeat the event and check that it succeeds without duplicate audit rows.
   Test through each replica and the collaboration endpoint. This checks access on
   the next authenticated operation; it does not erase previously downloaded data.
6. Disable the person through SCIM or the Work admin interface. Confirm every sign-in
   and device loses access, including linked personal identities. Re-enable only under
   the organisation's recovery procedure.
7. Rotate an IdP signing key in the candidate. A new `kid` should trigger an early JWKS
   refresh. Retain the old public key while tokens signed with it can still be valid.

Automated tests cover protocol failures and durable logout. They do not replace
these checks against a real provider, network and secret manager.

## 5. Operate and upgrade

**Offboarding.** Keep `linkedStandingDays: 30` and use SCIM/admin revocation as the
immediate control. Newly issued sessions that depend on another identity's groups
or admission expire at that identity's standing deadline even when their cookie
would last longer. Signing in through the personal provider does not refresh work
identity standing. Passkeys remain independent local credentials and do not acquire
a linked-identity standing deadline or an IdP `sid`. Their access continues until
local session expiry or SCIM/admin suspension; organisations requiring periodic
IdP reauthentication for passkeys need a separate policy change. Ordinary sign-out and a single `sid` logout are not account
suspension. Provision SCIM with the correct provider subject mapping; additional
provider subjects use `<id>:<sub>`. Follow [SCIM](identity.md#scim-provisioning) and
verify mappings before enabling automated deprovisioning.

**Release introducing logout.** Back up the database and retain the current image,
config and secret versions. Apply migration `0067_oidc_logout.sql` through the
normal migration runner before serving the new version. Helm's enabled migration
Job handles this; an image-only update helper does not run migrations. Run
`pnpm run migrate` and then `pnpm run migrate:status` with the intended database
when operating outside that Job. The new tables store hashed event and session
identifiers for durable, atomic replay protection and revocation across replicas.
Event records expire after ten minutes and session targets after thirty-one days,
covering the thirty-day maximum Work session chain. Cleanup runs on receipt of a
valid logout. A newer token issue time cannot revive a revoked `sid`.

Upgrade all replicas before depending on the new checks. Older cookies have no
IdP session binding or standing deadline, so they cannot acquire these protections
through renewal. Let them expire under the previous maximum lifetime or revoke
accounts' existing sessions and require fresh sign-in for a bounded cutover. Deploy
the updated Lolly shell to expose the provider sign-out action in Profile; the
updated Work console offers the same action independently.

**Rollback.** Retain the new tables; do not automatically reverse database migrations.
An older server does not enforce the new logout records or standing deadlines.
If reverting server code, restrict access until the security implications are
accepted and existing sessions have been revoked. Test the previous image against
the migrated database in the candidate environment before a rollback is needed.
Reverting an assurance setting affects future sign-ins; it does not reconstruct
sessions that were refused.

**Secret and issuer changes.** Follow [secret rotation](operations.md) for Work's
session/link keys and their previous-key overlap. Rotate client credentials in the
IdP and secret manager with provider-supported overlap, then roll all replicas and
verify a new login. JWKS keys are fetched automatically and cached for ten minutes,
with early refresh for an unknown `kid`; replacing a key under the same `kid` may
need that cache to expire. Issuer URLs, client IDs and additional-provider IDs are
identity boundaries: treat changes as a migration with account and SCIM mapping
checks, fresh login and a recovery owner, rather than a routine secret rotation.

Monitor `auth.failed`, `auth.denied`, `auth.logout-provider` and
`auth.backchannel-logout` audit actions and callback/logout HTTP errors. Liveness
alone does not establish that discovery, credentials, claims or SCIM work.
