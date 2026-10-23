# Account data controls

Someone leaves. This page is for the owner who ends their access today, then reviews what
they leave behind. It also covers exporting the metadata Work holds about a person, through
the API or `lw`. Shared content, audit rows and your configured retention stay in place
throughout; how long to keep them is a policy decision for your deployment, and these
commands do not make that decision.

::: timeline
- <!--i:search--> **Preview.** See the credentials and links the person issued, before anything changes.
- <!--i:lock--> **Offboard.** Disable the account, end every session and revoke what they issued, in one step.
- <!--i:folder--> **Transfer.** Hand their projects to someone else.
- <!--i:trash--> **Erase, when separately authorised.** Preview the erasure, then remove the account identity it reports.
:::

::: note None of these steps is a complete export or erasure
Each operation reports exactly what it covered and what it left for review. Handle personal
data however your organisation handles personal-data requests.
:::

## Leaving

**Preview.** Start with `GET /api/v1/users/:id/offboarding-preview`, or
`lw users offboard-preview USER_ID --json`. The preview reads at most 200 credential and link
metadata rows and marks truncation. Its counts include retained expired or revoked metadata;
the apply step checks live direct issuance again.

**Offboard.** `POST /api/v1/users/:id/offboard` needs an owner and a JSON body whose
`confirmUserId` equals the target account id; `lw users offboard USER_ID --json` supplies that
confirmation. One store transaction then:

- disables the account and increments its session epoch, so existing sessions stop being
  accepted at their next authorization check;
- revokes unrevoked service credentials the account issued directly;
- revokes its unrevoked share, guest and invitation links;
- removes unused password setup or reset links for the account's linked email addresses.

Each issuance category is bounded at 1,000 rows. If any category is over that bound, apply
refuses without changing the account or anything it issued. Review and revoke the relevant
pages with the existing credential, link and password-link controls, then retry. An account
cannot offboard itself. Both this operation and the ordinary disable keep another active
owner, with concurrent owner disables serialized in PostgreSQL. How disabling ends sessions
is on [Sign-in and sessions](identity.md#offboarding-disable-and-revocation).

After offboarding, review what the operation does not cover: credentials minted by a service
principal that came from a direct credential, queued work, the person's sessions and
provisioning at your identity provider, delivery destinations and provider connections.
Requests already authorized, or racing the operation, can leave records that need a second
review. Disabling an account does not transfer project ownership, remove shared work or erase
retained records.

**Transfer.** Hand each project to a new owner explicitly
([Team projects](team-projects.md#who-sees-a-project)).

**Erase.** Inspect `lw users erase-preview USER_ID` before any separately authorised account
erasure. The erasure API removes only the account identity and attribution scope it reports,
and it refuses while retained references remain. Shared content, original audit records,
external copies and backup restoration need separate handling. An account-row deletion is not
a complete personal-data erasure or a full subject export.

## Joining and moving

Use your identity provider and its scoped SCIM connector as the authority for identity and
groups ([SCIM provisioning](enterprise-identity.md#scim-provisioning)). Local invitations and
group changes are separate owner or admin actions ([Invite people and handle
requests](invitations.md)). Before moving a person to a different responsibility, review their
project roles, group-derived access and project ownership. Transferring a project or changing
a credential's owner is a separate, explicit action.

## Account metadata export

`GET /api/v1/users/:id/subject-export` needs an owner, and each successful read is recorded in
the audit log. It returns the account plus one category of direct metadata: `identities`,
`projects`, `credentials`, `links`, `telemetry`, `fleet` or `audit`. Choose a category with
`?category=credentials`. Pages default to 100 rows and accept a `limit` from 1 to 200.

```sh
lw users subject-export USER_ID --category credentials --limit 100 --json
lw users subject-export USER_ID --category credentials --cursor CURSOR --json
```

Follow the returned `nextCursor` for that account and category until it is null. The signed
cursor cannot be reused across categories or accounts. Reads are observations, not a database
snapshot: new or racing records can appear, so a completed page sequence is not a complete
subject export. Reading the audit category itself creates later audit references.

What the pages leave out:

- Credential and link pages exclude token hashes, signed URLs, password hashes and render
  parameters.
- Audit pages contain the source sequence and hash references with time and action, without
  payloads.
- Values are bounded, and a page reports `metadataValuesOmitted` when the size limits omit
  fields.
- Direct project membership excludes group-derived access.
- Aggregate telemetry, removed attribution, indirect audit mentions, shared contents,
  revisions, upload or render bytes, integrations, device caches, external copies and backups
  need separate review.

Treat the account and identity fields as personal data. The API always sends
`Cache-Control: no-store`.

## SIEM projection format

Audit events forwarded to your SIEM pass through the same email privacy filter as the
retained audit log. Receiver authors need the envelope below.

::: details The lolly.audit-projection.v1 envelope
The forwarder sends `format: "lolly.audit-projection.v1"`. Each event has `version`,
`source`, `body`, `projectionDigest` and `projectionMac`. `source.seq`, `source.hash` and
`source.prevHash` identify the immutable retained audit row. They refer to that row; they do
not make the projected body verifiable as the original hash-chain body.

The projection applies the audit email privacy filter to historical and new bodies before
delivery. Keyed email digests use the audit deployment key, and existing digests stay stable.
Without a privacy key, identifying email values are omitted. Original rows, original hashes,
MACs and retention anchors are left unchanged. Historical plaintext still retained in the
database needs separate retention or operational handling.

`projectionDigest` is the SHA-256 of the canonical JSON of `{ version, source, body }`.
`projectionMac` is a base64url HMAC-SHA256 of `lw/siem-projection\n` followed by the digest,
using the key derived from `LW_SIEM_SECRET` with context `lw/siem-projection`. Receiver code
can use `verifyAuditProjection` from `server/src/audit/projection.ts`. The existing timestamp
and whole-body signature also authenticate each batch. Failed deliveries replay the same
projections, and the source cursor advances only after a successful response.

Qualify the receiver against this versioned envelope before rollout; a receiver expecting the
previous raw event shape needs an explicit adapter. Deduplicate deliveries by deployment
identity and source sequence and hash, and keep the format and projection proof. Key rotation
can change a historical projection's keyed identifiers, while its source references stay
stable. There is no automatic raw-record fallback and no historical chain rewrite.
:::

Forwarding itself is configured in [operations](operations.md#siem-forwarding).
