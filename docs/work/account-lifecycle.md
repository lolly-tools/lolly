# Account lifecycle operations

An owner can export bounded account metadata and disable a departed account through the API or `lw`. These operations retain shared content, audit rows and the configured retention policy. Retention periods require a deployment policy decision; the commands do not choose them.

## Joining and moving

Use the installed identity provider and its scoped SCIM connector for authoritative identity and groups. Local invitations and group changes remain separate owner or administrator actions. Review project roles, group-derived access and ownership before moving a person to a different responsibility. Transferring a project or changing a credential's owner requires the existing explicit ownership process.

## Account metadata export

`GET /api/v1/users/:id/subject-export` requires an owner and records each successful read in the audit log. It returns the account plus one category of direct metadata. Categories are `identities`, `projects`, `credentials`, `links`, `telemetry`, `fleet` and `audit`. Select a category with `?category=credentials`; pages default to 100 rows and accept `limit` from 1 to 200.

Use the returned `nextCursor` for that account and category until it is null. The signed cursor cannot be reused across categories or accounts. Reads are observations, not a database snapshot. New or racing records can appear; a completed page sequence does not establish a complete subject export. Audit export reads themselves create later audit references.

Credential and link pages exclude token hashes, signed URLs, password hashes and render parameters. Audit pages contain source sequence and hash references with time and action, without payloads. Values are bounded and report `metadataValuesOmitted` when the size limits omit fields. Direct project membership excludes group-derived access. Aggregate telemetry, removed attribution, indirect audit mentions, shared contents, revisions, upload or render bytes, integrations, device caches, external copies and backups require separate review.

For example:

```sh
lw users subject-export USER_ID --category credentials --limit 100 --json
lw users subject-export USER_ID --category credentials --cursor CURSOR --json
```

Treat the resulting account and identity fields as personal data and handle the export through the deployment's approved access and delivery process. The API always sends `Cache-Control: no-store`.

## Leaving

First inspect `GET /api/v1/users/:id/offboarding-preview`, or `lw users offboard-preview USER_ID --json`. The preview observes at most 200 credential and link metadata rows and marks truncation. Counts include retained expired or revoked metadata; the apply step rechecks live direct issuance.

`POST /api/v1/users/:id/offboard` requires an owner and a JSON body containing `confirmUserId` equal to the target account id. `lw users offboard USER_ID --json` supplies that confirmation. The store transaction disables the account, increments its session epoch, revokes unrevoked service credentials directly issued by that account and revokes its unrevoked share, guest and invitation links. Unused password setup or reset links for the account's linked email addresses are removed. Existing sessions stop being accepted at their next authorization check.

Each issuance category is bounded at 1,000 rows. If any category exceeds that bound, apply refuses without changing the account or issuance. Review and revoke the relevant pages with the existing credential, link and password-link controls, then retry. An account cannot offboard itself. Disabling through either the offboarding operation or the existing disable operation preserves another active owner, with concurrent owner disable requests serialized in PostgreSQL.

The operation does not claim complete offboarding. In particular, review credentials minted by a service principal descended from a direct credential, queued work, external identity-provider sessions and provisioning, delivery destinations and provider connections. Already authorized or racing requests can leave additional records that require a second review. Disabling a person's account does not transfer project ownership, remove shared work or erase retained records.

Transfer ownership explicitly, then inspect `lw users erase-preview USER_ID` before any separately authorized account erasure. The existing erasure API removes only its reported account identity and attribution scope, and blocks on retained references. Shared content, original audit records, external copies and backup restoration need their own approved lifecycle. Do not interpret an account-row deletion as complete personal-data erasure or a full subject export.

## SIEM projection format

The forwarder sends `format: "lolly.audit-projection.v1"`. Each event has `version`, `source`, `body`, `projectionDigest` and `projectionMac`. `source.seq`, `source.hash` and `source.prevHash` identify the immutable retained audit row. They are references to that row; they do not make the projected body verifiable as the original hash-chain body.

The projection applies the audit email privacy filter to historical and new bodies before delivery. Keyed email digests use the audit deployment key; existing digests stay stable. Without a privacy key, identifying email values are omitted. Original rows, original hashes, MACs and retention anchors are left unchanged. Historical plaintext still retained in the database needs a separately approved retention or operational action.

`projectionDigest` is SHA-256 of the canonical JSON of `{ version, source, body }`. `projectionMac` is base64url HMAC-SHA256 of `lw/siem-projection\n` followed by the digest, using the key derived from `LW_SIEM_SECRET` with context `lw/siem-projection`. Receiver code can use `verifyAuditProjection` from `server/src/audit/projection.ts`. The existing timestamp and whole-body signature also authenticate each batch. Failed deliveries replay the same projections and advance the source cursor only after a successful response.

Qualify the receiver against this versioned envelope before rollout; a receiver expecting the previous raw event shape needs an explicit adapter. Deduplicate deliveries by deployment identity and source sequence/hash, and retain the format and projection proof. Key rotation can change a historical projection's keyed identifiers; its source references remain stable. There is no automatic raw-record delivery fallback and no historical chain rewrite.
