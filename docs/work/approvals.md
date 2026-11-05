# Approvals

This page is for the admin who sets up who reviews what in Lolly Work, and for reviewers who
act on requests. An approval chain is an ordered list of steps, and each step gives the groups
who may approve it and a rule for when it is done. Chains are kept simple: no workflow
engine, no branching graph and no parallel steps.

::: figure work-approvals-chain
A request moves through each step in order. The submitter can never approve their own request, and a reject ends the request.
:::

![The approvals inbox: requests routed to your groups, and the ones you raised](shots/approvals-inbox.svg)

## Build a chain

```
GET /api/v1/chains
PUT /api/v1/chains/:id        # policy.edit
```

```json
{
  "id": "brand-review",
  "name": "Brand review",
  "version": 1,
  "steps": [
    { "name": "Design",   "approvers": { "groups": ["design-leads"] }, "rule": "any" },
    { "name": "Sign-off", "approvers": { "groups": ["sign-off"] },     "rule": { "quorum": 2 } }
  ],
  "onReject": "return-to-submitter"
}
```

| Rule | The step is done when |
|---|---|
| `any` | one eligible approver approves |
| `{ quorum: n }` | `n` **distinct** approvers approve |
| `all` | every **nominee named at submit** has approved; with no nominees it behaves as `any` |

Chains apply to work in three places today. Catalog submissions go through the chain that
`policy.submit.chain` gives ([catalog](catalog.md#submitting-an-asset)). A tool's exports go through
the chain its policy names in `enforce.escalation` ([review an exported file](#review-an-exported-file)).
Any other approval sets its `chainId` when it is raised.

### Edit chains in the console

The **Approval chains** console page edits ordered groups and `any`, quorum and `all` rules. It
moves steps and previews how many reviewers each step has. Editing needs `policy.edit`.

The preview leaves out disabled accounts, applies `approval.act` grants and denies, and
excludes you, because a requester cannot review their own work. It previews the chain; it
cannot promise every subject-specific grant or later nomination. Saving a chain advances its
version, and existing requests keep the snapshot they were submitted under.

### Who may act

Acting needs `approval.act` **and** membership of the step's approver groups, subject to
separation of duties. The `approver` role carries `approval.act`. A custom reviewer group whose
members have only the member role needs an explicit allow grant, for example `approval.act` on
`chain:brand-review`, and a deny still wins ([Roles and grants](permissions.md)). Nomination
choices, new nominations, notifications and the generic inbox also respect these permissions.

## Raise and act

```
POST /api/v1/approvals              # subjectType, subjectRef, title, chainId, nominees?
GET  /api/v1/approvals              # filtered to what the caller may see
GET  /api/v1/approvals/approvers    # who is eligible for a step, for nomination
POST /api/v1/approvals/:id/act      # { action: 'approve' | 'reject', comment? }
POST /api/v1/approvals/:id/withdraw
GET  /api/v1/approvals/:id/artifact # the file an export review carries
```

You can raise approvals with the subjects `asset`, `tool-change`, `config`, `guest-link`,
`source-review` or `export-review`. The server also raises `delivery` approvals for a destination with an approval
chain ([delivery](delivery.md#optional-human-approval)). One engine handles every kind.

The chain is **snapshotted at submit**: an approval is judged by the rules it was raised under,
so editing a chain never rewrites decisions already in progress.

States run `in_review`, then `approved`, `rejected` or `withdrawn`. A chain with no steps
approves at once.

## Rules the engine enforces

These are enforced in code and covered by tests:

- **Separation of duties.** The submitter can *never* complete a step. This is checked before
  eligibility, so they always get the specific reason (`SEPARATION_OF_DUTIES`).
- **Eligibility by group.** An actor's groups must overlap the step's approver groups
  (`NOT_ELIGIBLE`). Nomination is routing and notification, not exclusivity: any eligible
  member of the team may act, and nominees just get a notice.
- **No step is skippable.** A step completes by its rule, then the next one starts; the whole
  approval is `approved` only after the last step.
- **A reject is terminal.** `onReject: 'return-to-submitter'` means the submitter opens a
  *new* approval; there is no resume.

## Notification

Acting on an approval writes to the per-person inbox, so the approver's next shell poll, and
the console's Approvals view, shows what needs them. The console's overview shows "what needs
me" from the same source. Inbox targeting is described in the [API reference](api.md).

## Review an exported file

An export review is an approval of one exact file. A reviewer sees the file, and the approved
download is that file.

**Set it up.** Choose an approval chain for the tool in its policy (**Approval chain for exports**
in the console, or `enforce.escalation`). To route a group's exports through review, deny them
`export.download`; a member who holds `export.request` then sees **Request approval** in place of
Download. On this path the app is cooperating with your policy: the file is made on the person's
own device, so this guides how work moves and does not stop someone copying what is on their screen.

**Ask for a review.** **Request approval** runs the same export as Download, with the settings on
the export bar. The dialog shows the file, its format, size and digest, and sends it to Work.
Nothing is downloaded, saved to the library or sent to an export home.

**Review.** In the console, the request's card loads the file, checks the bytes against the digest
and shows the artwork. **Approve** stays off until that has happened. A PDF opens in a new tab, and
a large file waits until you choose to load the file.

**Get the file.** The requester sees the facts and the digest while the request is open, and gets
the file once it is approved, from the request's card or with `lw approvals artifact <id> --out <file>`.
A rejected or withdrawn request never releases the file to the requester.

**In the app.** The export bar shows where the current inputs stand, in the control Download would
hold: **Request approval**, then **In review**, then **Download approved file**. Change an input or
the format and it goes back to **Request approval**, with "Changed since approval." under it. A
rejected request says "Not approved." with **See why**. Download approved file fetches the stored
bytes and runs no export, so the file is the one that was reviewed.

Requests you can decide and decisions on your own requests appear in the app's notifications.
**Review** opens the file, its facts, a comment, **Approve** and **Reject**, under the same rules as
the console, which stays the place for chains and history. A saved session with a request shows
**In review** or **Approved** on its card in Projects and in its info sheet.

**Add to project** on an approved request puts the file in a project. A device folder keeps a
reference to your own copy in Assets, and that copy links back to the request. A shared project
receives a file copy, which does not carry the link. Neither reaches the organisation catalog.

**What the record holds.**

- The file's SHA-256, size, name, format and media type. The media type comes from the file's
  opening bytes, and a file that contradicts its named format is refused.
- The tool and the version this instance serves.
- A digest of the input values the app reported, worked out by the server with the steps a server
  render uses: values parsed from URL mode, locked values applied, defaults and profile fields
  filled in. The values themselves are not stored. If the tool is not in this instance's pack, or
  the values were too large to send, the digest is empty and the record says why.
- The fingerprint a decision is bound to, and the actions taken.

**What a request does and does not add to the file.** Work writes nothing into the file and adds
no watermark. The file holds what the export wrote, including any Content Credentials or Lolly
Imprint turned on at the export bar. An experimental tool keeps its usual mark, so the reviewer
sees the file exactly as it will leave.

**Limits.**

- An approval says a person approved this file. It does not establish that the file meets a brand
  rule, a licence or a law.
- The inputs digest rests on what the requesting app states. It does not prove the file was made
  from those inputs.
- A changed file is a new request. Nothing in a request can be rewritten.
- Sending to a [delivery destination](delivery.md) is a separate step with its own permission
  and optional approval.
- Older shells still send a request with the tool's id and no file. It stays valid, and its card
  says no file is attached.

**Storage.** `policy.approvalArtifacts` sets the largest file, the total stored and how long a
decided request keeps its file ([configuration](configuration.md#files-and-uploads)). Withdrawing
removes the file at once. The record and digest stay after the file goes, and `GET .../artifact`
answers `410`.

**Refusals.**

| Code | Status | Meaning |
|---|---|---|
| `ARTIFACT_NOT_RELEASED` | 403 | the requester asked for the file before approval |
| `ARTIFACT_NOT_LOADED` | 409 | an approve came without the token the file's own response carries |
| `ARTIFACT_SUBJECT_CHANGED` | 409 | an action did not echo the fingerprint of the frozen file |
| `ARTIFACT_REMOVED` | 410 | the request no longer holds its file |
| `ARTIFACT_FORMAT_MISMATCH` | 422 | the file's opening bytes contradict its named format |
| `APPROVAL_ARTIFACT_BUDGET` | 413 | the instance has no room for another request file |
| `CHAIN_NOT_BOUND` | 400 | the tool's policy gives a different chain |

## Review a set of source files

A source review records an approval of an exact set of original files, for one stated purpose
and target. Use it when the question is "were these exact files approved for this", not "is
this asset in the catalog".

`POST /api/v1/approvals` accepts `subjectType: "source-review"` with a `sourceReview`
containing a non-empty `purpose`, an explicit activation `target` and up to 32 exact files.
Each file gives `assetId`, an integer `version`, `format`, a lowercase hex `sha256` and
`representation: "original"`. Directly owned `inst/*` originals are supported. Materialized
provider files and previews need their own qualification and are refused.

- Lolly Work verifies the actual bytes and freezes the purpose, target and complete membership under
  one fingerprint.
- The request and decision record whether a member session or an agent acting through
  delegated authority made them; neither is an automated-rule approval.
- A member cannot approve their own request, and the chosen chain still controls who is
  eligible.
- Source access is checked for every member of the frozen set, at request and at action. A
  hidden member hides the whole review, including its count. Review history also follows its
  requester and reviewer audience, and no decision widens a source grant.

An action must echo the `sourceFingerprint` from the review on screen. Older clients that
cannot display and confirm the frozen subject are refused before a decision is recorded; the
updated console supplies the fingerprint for approve and reject. The version-history response
advertises `sourceReviewCapability` only for this supported path: at most 64 MiB per file and
128 MiB for the whole subject. Clients without that capability keep ordinary history and do
not offer a source review.

Replacing a file does not carry the review to its replacement, and changing the purpose,
target or membership creates a different subject. An approval is historical evidence about the
exact reviewed source set. Catalog admission, conformance, processing authority and approval of
final delivery bytes stay separate, and source attribute history stays `not-recorded` even when
old original bytes exist. The version-history response includes visible `sourceReviews`
without claiming that the current version was reviewed. The Assets source-history form requests
a review of one selected instance file; the API supports bounded sets.

## Watermarking preview output

An overlay can set `enforce.watermark: 'until-approved'`, meant to pair with a chain so that
server previews carry the PREVIEW pattern while the work is unapproved. That link to approval state
is not built yet. What each watermark setting does today is in [the enforce
block](governance.md#the-enforce-block).

## Related

- Who can approve: [Roles and grants](permissions.md)
- Binding a chain to a tool: [governance](governance.md)
- Exporting chains as code: [governance](governance.md#policy-as-code)
