# Approvals

This page is for the admin who sets up who reviews what in Lolly Work, and for reviewers who
act on requests. An approval chain is an ordered list of steps, and each step gives the groups
who may approve it and a rule for when it is done. Chains are kept simple: no workflow
engine, no branching graph and no parallel steps.

::: figure work-approvals-chain
A request moves through each step in order. The submitter can never approve their own request, and a reject ends the request.
:::

![The approvals inbox: requests routed to your groups, and the ones you raised](shots/approvals-inbox.svg)

<!--i:eti-link-->
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

Chains apply to work in these places:

- **Catalog submissions** go through the chain that `policy.submit.chain` gives
  ([catalog](catalog.md#submitting-an-asset)).
- **A tool's exports** go through the chain its policy names in `enforce.escalation`
  ([review an exported file](#review-an-exported-file)).
- **Brand page revisions** wait on the chain `brandPages.approvalChain` gives
  ([host a brand page](design-system-administration.md#who-may-publish)).
- **Studio edits to this instance's design system** wait on the chain chosen under **Edits need
  approval before they go live** ([the two switches](design-system-administration.md#the-two-switches)).
- **Partner programmes** can send a company's contact edits, its kit changes and its agents'
  requests to a chain ([Partner approvals](partner-approvals.md)).

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

<!--i:eti-stamp-->
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
chain ([delivery](delivery.md#optional-human-approval)), `brand-page` and `brand-edit` approvals for a
brand page revision or a studio edit, and `company-profile` and `partner-kit` approvals for a partner
company's contact edits and kit changes. One engine handles every kind.

The chain is **snapshotted at submit**: an approval is judged by the rules it was raised under,
so editing a chain never rewrites decisions already in progress.

States run `in_review`, then `approved`, `rejected` or `withdrawn`. A chain with no steps
approves at once.

<!--i:eti-shield-check-->
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

<!--i:eti-mail-->
## Notification

Acting on an approval writes to the per-person inbox, so the approver's next shell poll, and
the console's Approvals view, shows what needs them. The console's overview shows "what needs
me" from the same source. Inbox targeting is described in the [API reference](api.md).

<!--i:eti-file-->
## Review an exported file

An export review is an approval of one exact file. A reviewer sees the file, and the approved
download is that file, with a signed record of the approval added when the requester chose one.

**Set it up.** Choose an approval chain for the tool in its policy (**Approval chain for exports**
in the console, or `enforce.escalation`). To route a group's exports through review, deny them
`export.download`; a member who holds `export.request` then sees **Request approval** in place of
Download.

::: note Review guides the work and does not contain it
On this path the app is cooperating with your policy: the file is made on the person's own device,
so this guides how work moves and does not stop someone copying what is on their screen.
:::

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
hold: **Request approval**, then **In review**, then **Download approved file**, with a line below
that gives the file, such as "Approved Nov 5, 2026. SVG, 600 × 600."

An approval covers one exact file. Change an input, the format, the width or the height and the
control goes back to **Request approval**, and the line below reads "Changed since approval." with
**See request**, which still holds the approved file. A new request at the new size shows **In
review**, and going back to the approved size offers that file again. A rejected request says "Not
approved." with **See why**. Download approved file fetches the stored bytes and runs no export, so
the file is the one that was reviewed.

The app can compare only what a file records: its format, width and height. Marks, bleed,
transparency, text handling and other export settings are not on the record, so changing one of
them does not change the control. The app does not measure a PDF's page size, so a PDF compares on
format alone and its line gives no size.

Requests you can decide and decisions on your own requests appear in the app's notifications.
**Review** opens the file, its facts, a comment, **Approve** and **Reject**, under the same rules as
the console, which stays the place for chains and history. A saved session with a request shows
**In review** or **Approved** on its card in Projects and in its info sheet.

The app shows this queue and sheet to anyone who holds `export.request` or `approval.act`, including
a grant on one chain alone. This only tells the app to look: the routes still decide who may read a
file, request or act.

**Add to project** on an approved request puts the file in a project. A device folder keeps a
reference to your own copy in Assets, and that copy links back to the request. A shared project
receives a file copy, which does not carry the link. Neither reaches the organisation catalog.

**Record the approval in the file.** When this server has a [signing identity](c2pa.md), the dialog
offers **Record this approval in the file's Content Credentials**, ticked. The reviewed bytes stay
frozen. When the request is approved, the approved file is those bytes plus a signed credential
update, with the reviewed file's credential as its parent. The update records three facts: the
approval id, the date of the decision and the reviewed file's SHA-256. It holds no names, emails,
groups, comments or chain names. Like any credential, it also states the signer, the signing time
and the steps opened and published. The artwork does not change: Work compares the bytes outside
the credential before it keeps the update.

Both digests stay on the record, and anyone who may read the file can still get the reviewed bytes
with `?file=reviewed` or `lw approvals artifact <id> --out <file> --reviewed`. The update is made
once, so a repeat download gives the same bytes. To turn recording off, untick the box for one
request, or set `policy.approvalArtifacts.recordInCredentials` to `false` for the instance. Then
every byte of the approved file matches the reviewed file.

The record is written only when all of these hold, and the card says which one did not:

::: details Every reason the card can give
| Reason on the card | What it means |
|---|---|
| `opted-out` | the requester unticked the box |
| `not-offered` | the request came from an app or an instance that did not offer the choice |
| `instance-off` | `recordInCredentials` is `false` |
| `no-signing-identity` | this server has no signing identity |
| `engine-unsupported` | this server's engine cannot write the record yet |
| `too-large` | the file is over 128 MiB |
| `no-route` | the format has no update route. PNG, JPEG, SVG and PDF do |
| `no-credential` | the reviewed file has no Content Credentials to update, and it is not given a first one |
| `write-failed`, `readback-failed`, `artwork-changed` | the update did not pass its own checks, so it was discarded |
:::

Work says **recorded** only after reading the update back: the credential is intact, the record says
what was asked and the bytes outside the credential match the reviewed file. In every other case the
approved file is the reviewed file. A PDF keeps the reviewed file as an exact prefix, with the update
as one more incremental revision. A PDF that holds other attachments is left as reviewed.

**What the record holds.**

- The file's SHA-256, size, name, format and media type. The media type comes from the file's
  opening bytes, and a file that contradicts its named format is refused.
- The tool and the version this instance serves.
- A digest of the input values the app reported, worked out by the server with the steps a server
  render uses: values parsed from URL mode, locked values applied, defaults and profile fields
  filled in. The values themselves are not stored. If the tool is not in this instance's pack, or
  the values were too large to send, the digest is empty and the record says why.
- The fingerprint a decision is bound to, and the actions taken.

**What a request does and does not add to the file.** Asking for a review adds nothing. The reviewed
file holds what the export wrote, including any Content Credentials or Lolly Imprint turned on at the
export bar, and Work adds no watermark. An experimental tool keeps its usual mark, so the reviewer
sees the artwork as it will leave.

::: note Limits of an approval
- An approval says a person approved this file. It does not establish that the file meets a brand
  rule, a licence or a law. The record in the file says the same and no more: a signer recorded a
  decision, and a viewer still has to trust that signer.
- The inputs digest rests on what the requesting app states. It does not prove the file was made
  from those inputs.
- A changed file is a new request. Nothing in a request can be rewritten.
- Sending to a [delivery destination](delivery.md) is a separate step with its own permission
  and optional approval.
- Older shells still send a request with the tool's id and no file. It stays valid, and its card
  says no file is attached.
:::

**Reading the record.** [Lolly Verify](/info/what-verify-checks.html#approval-and-intent-records)
shows a file's record as an **Approved** panel, and [Assets](/info/authoring-assets.html#approval-and-intent-in-details)
shows the same panel from an **Approval** row in Details. `lolly validate`, the terminal app and
`lolly_verify` report the same facts. If the file changed after the record was written, each of them
says so and keeps the record visible.

**Storage.** `policy.approvalArtifacts` sets the largest file, the total stored and how long a
decided request keeps its file ([configuration](configuration.md#files-and-uploads)). Withdrawing
removes the file at once. The record and digest stay after the file goes, and `GET .../artifact`
answers `410`.

::: details Refusals, with their codes and statuses
| Code | Status | Meaning |
|---|---|---|
| `ARTIFACT_NOT_RELEASED` | 403 | the requester asked for the file before approval |
| `ARTIFACT_NOT_LOADED` | 409 | an approve came without the token the file's own response carries |
| `ARTIFACT_SUBJECT_CHANGED` | 409 | an action did not echo the fingerprint of the frozen file |
| `ARTIFACT_REMOVED` | 410 | the request no longer holds its file |
| `ARTIFACT_FORMAT_MISMATCH` | 422 | the file's opening bytes contradict its named format |
| `APPROVAL_ARTIFACT_BUDGET` | 413 | the instance has no room for another request file |
| `CHAIN_NOT_BOUND` | 400 | the tool's policy gives a different chain |
:::

<!--i:eti-images-->
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

**Confirming the subject.** An action must echo the `sourceFingerprint` from the review on screen.
Older clients that cannot display and confirm the frozen subject are refused before a decision is
recorded; the updated console supplies the fingerprint for approve and reject. The version-history
response advertises `sourceReviewCapability` only for this supported path: at most 64 MiB per file
and 128 MiB for the whole subject. Clients without that capability keep ordinary history and do not
offer a source review.

**What a review does not carry.** Replacing a file does not carry the review to its replacement, and
changing the purpose, target or membership creates a different subject. An approval is historical
evidence about the exact reviewed source set. Catalog admission, conformance, processing authority
and approval of final delivery bytes stay separate, and source attribute history stays
`not-recorded` even when old original bytes exist. The version-history response includes visible
`sourceReviews` without claiming that the current version was reviewed. The Assets source-history
form requests a review of one selected instance file; the API supports bounded sets.

<!--i:eti-watermark-->
## Watermarking preview output

An overlay can set `enforce.watermark: 'until-approved'` and pair it with a chain. Server renders of
that tool then carry the PREVIEW pattern until a request for the same tool version, format and input
values is approved. An approved match lifts the pattern everywhere, including share links. Work adds
no PREVIEW pattern to the file under review itself, because that is the file being approved. [A watermark that follows approval](governance.md#a-watermark-that-follows-approval)
has the rule and its limits.

<!--i:eti-search-->
## Check the state of a request

`POST /api/v1/approvals/match` tells a signed-in person the state of a tool, a format and a set of
input values, so an app can show the right action on its export bar. Send
`{ toolId, format, query }`, with the inputs as a URL-mode query. The answer holds no file and no
values, and Work keeps none of the values you send.

| `state` | Meaning |
|---|---|
| `none` | no request you may read covers this |
| `in_review` | a request for these inputs is waiting for a decision |
| `approved` | a request for these inputs and this tool version was approved |
| `rejected` | a request for these inputs was rejected |
| `changed` | you have a request for this tool and format, under other inputs or an older tool version |

Beside `state` come `approvalId`, `fingerprint`, `title` and, once decided, `decidedAt`. The answer
covers your own requests and those you may read as a reviewer or someone who acted. Someone else's
approved request that you may not read answers `none`, even though a server render of those inputs
is unmarked. The route needs a person's session.

<!--i:eti-map-pin-->
## Related

- Who can approve: [Roles and grants](permissions.md)
- Binding a chain to a tool: [governance](governance.md)
- Exporting chains as code: [governance](governance.md#policy-as-code)
- One approval for a published template's variants:
  [Partner approvals](partner-approvals.md#one-approval-for-a-template-s-variants)
- Partners' agents that ask for review: [Partner approvals](partner-approvals.md#requests-from-partners-agents)
