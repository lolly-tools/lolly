# Sign-in provider recipes

This page is for the operator connecting a sign-in provider to Lolly Work: the configuration
for each provider, how several providers share one instance, and how a reverse proxy can sign
people in. Who gets in and how sessions behave are on [Sign-in and sessions](identity.md).
The full rollout, with logout and optional assurance, is [Set up enterprise
identity](enterprise-identity.md).

Every recipe uses one redirect URI: `<instance.baseUrl>/api/auth/callback`. Secrets go in
environment variables, never in the configuration file: `LW_IDP_CLIENT_SECRET` for the
primary provider, and the variable that `clientSecretRef` points at for an additional one.

## OpenID Connect sign-in

Nothing in the code knows your provider. Set:

```json
"idp": {
  "issuer": "https://id.example.com/realms/main",
  "clientId": "lolly-work",
  "displayName": "Keycloak",
  "groupsClaim": "groups",
  "claimMap": { "firstname": "given_name", "lastname": "family_name", "email": "email", "title": "title" }
}
```

The flow is discovery, then Authorization Code with PKCE (S256), then the `id_token` verified
against the provider's JWKS (RS256 by default) **before any claim is believed**. Verified
claims fill the person's account through `claimMap`.

- The redirect URI is `<instance.baseUrl>/api/auth/callback`. `baseUrl` must match the URL
  the deployment actually answers on.
- Set `LW_IDP_CLIENT_SECRET` only when your provider issues a confidential client.
- `displayName` is what the sign-in button and the "managed by …" copy say. Any compliant
  issuer that matches the supported token and logout profile works.

Routes: `GET /api/auth/config` (what the sign-in screen needs), `GET /api/auth/login`,
`GET /api/auth/callback`, `GET /api/auth/session`, `POST /api/auth/logout`,
`POST /api/v1/me/revoke-sessions` ([sign out on all
devices](identity.md#offboarding-disable-and-revocation)), and for [email and
password](identity.md#email-and-password) `POST /api/auth/password/login` and
`GET`/`POST /api/auth/password/set`.

The sign-in and invitation pages share the console's local theme and fonts. Brand colours and
fonts come from the active design-token source on the server, and these pages need no scripts
or external assets.

### Requested scopes and extra parameters

Per provider, `scopes` replaces the default `openid profile email` and must include `openid`.
`authParams` adds authorization request parameters from a fixed allowlist: `prompt`, `hd`,
`domain_hint`, `login_hint` and `acr_values`. Nothing else is accepted. `hostedDomain` is also
sent as `hd`, so Google's account picker offers the right account first. A sign-in link may
add `prompt=select_account` or `prompt=login`; no other query parameter reaches the provider.

## More than one IdP

A migration in progress, or a subsidiary with its own directory: `idp.additional` lists
further issuers beside the primary.

```json
"idp": {
  "issuer": "https://id.example.com/realms/main", "clientId": "lolly-work", "displayName": "Example ID",
  "additional": [{
    "id": "subsidiary", "issuer": "https://login.subsidiary.example", "clientId": "lolly",
    "displayName": "Subsidiary SSO", "groupsClaim": "roles", "clientSecretRef": "LW_IDP_SECRET_SUBSIDIARY"
  }]
}
```

- Each entry has its own client and display name, and optionally its own `groupsClaim` and
  `claimMap`; unset ones inherit the primary's. A confidential secret comes from the
  environment variable that `clientSecretRef` gives. Omit it for a public PKCE client.
- With several providers configured, plain `/api/auth/login` serves a chooser page with no
  script, so every existing sign-in link (the console gate, Lolly's own sign-in gate) gains
  the buttons with no client change. `?idp=<id>` picks one directly, and `/api/auth/config`
  and `GET /api/v1/instance` list `providers` for clients that draw their own.
- The provider that **starts** a flow finishes it, because its id travels in the signed state
  token.
- An additional provider's subjects are stored namespaced (`<id>:<sub>`), so two issuers
  handing out the same bare subject never collide in one account. The primary's subjects stay
  raw, so existing accounts and the SCIM `externalId` link are untouched.

## Planned sign-ins

`idp.pending` lists providers that appear as disabled choices on the sign-in and invitation
pages. For example, `"pending": ["Company SSO"]` shows **Company SSO (pending)** without adding
a sign-in route. Remove the name when you add the registered provider to `idp.additional`.

For that provider, get the app's actual issuer and client ID from the provider's
administrator, register `https://work.example.com/api/auth/callback` (your `instance.baseUrl`
followed by `/api/auth/callback`), and store its secret in the environment variable that
`clientSecretRef` gives. The discovery URL is specific to the app registration. The usual
admission, invitation and email-verification checks apply to this provider too.

## Provider recipes

### Google

In Google Cloud Console, set up the OAuth consent screen ("Internal" keeps it to one
Workspace; "External" in "Testing" adds Google's own test-user list), then go to
Credentials, OAuth client ID, type Web application, with the redirect URI above.

```json
{ "issuer": "https://accounts.google.com", "clientId": "….apps.googleusercontent.com",
  "displayName": "Google", "emailVerification": "claim", "hostedDomain": "example.com" }
```

Omit `hostedDomain` to accept personal Google accounts as well, and then admit people by
exact `emails` or by invitation only. Domain admission on Google needs `hostedDomain`: Google
reports `email_verified: true` for a personal Google account registered with a non-Gmail
address, and that account outlives the mailbox. A departed employee's personal account for
`alex@example.com` would still match `domains: ["example.com"]`.

Google sends no groups, so use `bootstrapOwners` for the first owner and local groups after
that ([bootstrap owners](identity.md#bootstrap-owners)).

### Microsoft Entra ID (single tenant)

Go to App registrations, New registration, "Accounts in this organizational directory only",
add a Web redirect URI as above, then create a client secret. Add the optional `email` claim,
or map the sign-in name as below. For roles, define app roles on the registration, assign
people or groups to them, and read the `roles` claim.

```json
{ "id": "microsoft", "displayName": "Microsoft",
  "issuer": "https://login.microsoftonline.com/<tenant-id>/v2.0",
  "clientId": "<application id>", "clientSecretRef": "LW_IDP_MICROSOFT_SECRET",
  "tenantId": "<tenant-id>", "emailVerification": "trusted",
  "groupsClaim": "roles", "claimMap": { "email": "preferred_username" } }
```

`trusted` is right here because `tenantId` pins the directory and Entra does not send
`email_verified`.

Personal Microsoft accounts use a separate consumers-only registration, whose tenant id is
`9188040d-6c67-4c5b-b112-36a304b66dad` (issuer
`https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0`). Anyone can
create such an account, so keep `emailVerification` at `claim` there and admit by `emails`.
Multi-tenant issuers (`{tenantid}` templating) and the groups overage claim are not supported
yet.

### Okta

Go to Applications, Create App Integration, OIDC, Web Application, with client authentication
"Client secret post" (Work sends the secret in the token request body, not in a Basic header)
and the sign-in redirect URI above. On the authorization server, add a `groups` claim to the
ID token, with a filter such as "Starts with lolly-".

```json
{ "issuer": "https://<org>.okta.com/oauth2/default", "clientId": "…",
  "displayName": "Okta", "groupsClaim": "groups" }
```

### Keycloak

Create a confidential OpenID Connect client in your realm with the redirect URI above, and add
a "Group Membership" mapper to the ID token (token claim name `groups`, "Full group path" off).

```json
{ "issuer": "https://id.example.com/realms/<realm>", "clientId": "lolly-work",
  "displayName": "Keycloak", "groupsClaim": "groups" }
```

### Auth0

Create a Regular Web Application with the callback URL above, and leave the signing algorithm
at RS256 (Advanced settings, OAuth). Auth0 sends no groups by default: add them with an Action
that sets a namespaced claim, and point `groupsClaim` at that claim.

```json
{ "issuer": "https://<tenant>.eu.auth0.com/", "clientId": "…", "displayName": "Auth0",
  "groupsClaim": "https://lolly.example/groups" }
```

The Auth0 issuer ends in a slash; copy it exactly from the discovery document.

### GitHub

GitHub sign-in is OAuth 2.0, not OpenID Connect, so it has its own adapter: an additional
provider with `kind: "github"`. In GitHub, open Settings, Developer settings, OAuth Apps, New
OAuth App (for an organisation, the organisation's own Developer settings). Set the Homepage
URL to `instance.baseUrl` and the Authorization callback URL to
`<instance.baseUrl>/api/auth/callback`, the same callback every provider uses. Generate a
client secret and put it in the environment variable that `clientSecretRef` gives. Leave
device flow off.

```json
{ "id": "github", "kind": "github", "displayName": "GitHub",
  "clientId": "<client id>", "clientSecretRef": "LW_IDP_GITHUB_SECRET" }
```

- A GitHub entry takes no `issuer`, `scopes`, `authParams`, `hostedDomain` or `tenantId`, and
  the server refuses a configuration that sets one. It always asks for two scopes:
  `read:user` for the profile and `user:email` for the email list. The sign-in uses PKCE
  (S256), and the person may create a GitHub account on the way (`allow_signup`).
- The subject is the numeric GitHub user id, stored as `github:<id>` with the entry's `id` as
  the prefix. The login name is never the identity, because people rename accounts and a
  freed login can be claimed by someone else.
- The email is the primary address when GitHub has verified it, otherwise the first verified
  address. The `@users.noreply.github.com` commit address is used only when nothing else is
  verified.
- GitHub lets anyone add any address to an account without proving it. An account with no
  verified address is therefore refused on every instance, open or not, with a page asking
  the person to add and confirm one (`auth.failed`, reason `no-email`). For the same reason a
  GitHub entry accepts only `emailVerification: "claim"`, the default.
- "Keep my email addresses private" in GitHub does not hide the list from this app:
  `user:email` reads private addresses too, so the address shown in Lolly Work may differ
  from the public profile. For invitations only, every other verified address on the account
  counts too ([GitHub addresses](invitations.md#github-addresses)).
- GitHub sends no groups: use `bootstrapOwners` for the first owner and local groups after
  that.

A failed exchange (a stale code, GitHub unreachable, a missing or wrong client secret) shows
a phone-friendly page with a **Try again** link and writes an `auth.failed` audit row (actor
`anonymous`; payload `provider: "github"`, `idp`, and `reason`: `token`, `profile` or
`no-email`). GitHub's own error text and the access token never reach the page or the audit
log. The token is used for two API reads and then dropped.

### SAML

SAML is a different protocol and does not connect directly. Put a broker in front, such as an
Auth0 SAML enterprise connection or a Keycloak SAML identity provider in your realm. Work then
talks OpenID Connect to the broker as in the recipes above.

## Reverse-proxy sign-in

Some hosts already sign people in before a request reaches the instance: YunoHost's SSOwat,
Authelia, oauth2-proxy or an enterprise gateway. `proxyAuth` lets that proxy act as the
identity provider. The proxy states who the person is in request headers, and
`GET /api/auth/proxy?returnTo=…` turns those headers into an ordinary member session: the same
cookie, the same role derivation and the same audit row (`auth.login` with `provider:
"proxy"`). Members get the subject `proxy:<login>`.

::: warning Enable this only behind a proxy you control
Turn on `proxyAuth` only when both hold: the proxy strips every identity header a client
sends before adding its own, and the proxy is the only thing that knows the shared secret.
With either missing, anyone who can reach the port can claim to be anyone.
:::

```json
"proxyAuth": {
  "enabled": true,
  "displayName": "YunoHost",
  "secretRef": "LW_PROXY_AUTH_SECRET",
  "headers": { "user": "ynh_user", "email": "ynh_user_email", "name": "ynh_user_fullname", "groups": "" },
  "groups": { "ana": ["owner"] },
  "directory": {
    "url": "ldap://127.0.0.1:389",
    "userDn": "uid={user},ou=users,dc=yunohost,dc=org",
    "groupMap": [
      { "attribute": "memberOf",   "pattern": "^cn=([^,]+),ou=groups,dc=yunohost,dc=org$" },
      { "attribute": "permission", "pattern": "^cn=lolly-work\\.(owner|admin|approver|author),ou=permission,dc=yunohost,dc=org$" }
    ]
  }
}
```

**The header contract.** `headers.user` is the only required header: the stable login the
proxy asserts. `email` and `name` fill the account when present, and `groups` is a
comma-separated list when the proxy sends one (Authelia's `Remote-Groups`). Header names
match without regard to case, so `YNH_USER` and `Remote-User` both work as written.

| Proxy | Headers |
|---|---|
| YunoHost SSOwat (the defaults) | `YNH_USER`, `YNH_USER_EMAIL`, `YNH_USER_FULLNAME` |
| Authelia | `remote-user`, `remote-email`, `remote-name`, `remote-groups` |
| oauth2-proxy | `x-forwarded-user`, `x-forwarded-email` |

**The shared secret.** The proxy must add one more header, `x-lw-proxy-auth`, carrying the
value of the environment variable that `secretRef` gives (`LW_PROXY_AUTH_SECRET` by default).
A request without it, or with the wrong value, is refused with `403 PROXY_SECRET_MISMATCH`
and an `auth.proxy.rejected` audit row; the presented value is never recorded. This stops a
process on the same host from reaching the instance port directly and claiming to be an
owner. In production the variable is required whenever the provider is enabled, and the
server refuses to boot without it.

**Static grants.** `groups` maps a login to groups that are added at every sign-in. This is
how a deployment gives its first owner the `owner` group before any directory or group header
exists. Role still comes from groups, never from a direct assignment.

**The directory.** An optional LDAP read of the person's own entry, once per sign-in:

- `userDn` is a template. `{user}` is replaced with the login, escaped per RFC 4514 so a login
  can never break out of its own RDN.
- `attributes` (defaults `mail`, `givenName`, `sn`, `cn`) fill whatever the headers left
  blank.
- `groupMap` turns attribute values into groups: every value of `attribute` that matches
  `pattern` contributes its first capture group.
- The bind is anonymous unless `bindDn` is set; the bind password comes from the environment
  variable that `bindPasswordRef` gives.
- Groups from the headers, the directory and the static grants are combined, and a group named
  after the login itself is dropped (YunoHost gives every account a primary group of its own
  name).
- The directory fails closed: configured but not answering means `502 DIRECTORY_UNAVAILABLE`
  and no session, never a session with fewer groups than the person holds.
- The client is `server/src/iam/ldap.ts`: plain `ldap://` over TCP, meant for the loopback of
  the host that owns the directory.

The route uses the `auth` rate-limit bucket. `POST /api/auth/logout` clears the instance
session only; ending the proxy's own session is up to the proxy.

::: details YunoHost, worked through
SSOwat authenticates against the portal, strips any `ynh_*` header and any `Authorization:
Basic` a client sent, then sets `YNH_USER`, `YNH_USER_EMAIL` and `YNH_USER_FULLNAME` for a
signed-in user. Each user's LDAP entry carries `memberOf` (YunoHost groups) and `permission`
(the app permissions the user holds), which the two `groupMap` rules above turn into groups.
A YunoHost group `marketing` becomes the Work group `marketing`, and the app permissions
`lolly-work.owner`, `.admin`, `.approver` and `.author` become the role groups. Roles are
therefore managed in YunoHost's own Users, Groups and permissions screen, and take effect at
the next sign-in. The YunoHost package sets all of this up, including the nginx line that
adds the secret.
:::

## The dev provider

`dev.enabled: true` with a `dev.users` list enables `GET /api/auth/dev?email=…`: a
passwordless local sign-in for development, demos and tests. It bypasses OpenID Connect
entirely, so keep it off in production. The Helm values ship it disabled.
