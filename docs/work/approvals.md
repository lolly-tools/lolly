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

Chains apply to work in two places today. Catalog submissions go through the chain that
`policy.submit.chain` gives ([catalog](catalog.md#submitting-an-asset)), and any other approval
sets its `chainId` when it is raised. The overlay key `enforce.escalation` is declared but not
accepted by the write paths ([the enforce block](governance.md#the-enforce-block)).

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
```

You can raise approvals with the subjects `asset`, `tool-change`, `config`, `guest-link` or
`source-review`. The server also raises `delivery` approvals for a destination with an approval
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

## Review a set of source files

A source review records an approval of an exact set of original files, for one stated purpose
and target. Use it when the question is "were these exact files approved for this", not "is
this asset in the catalog".

`POST /api/v1/approvals` accepts `subjectType: "source-review"` with a `sourceReview`
containing a non-empty `purpose`, an explicit activation `target` and up to 32 exact files.
Each file gives `assetId`, an integer `version`, `format`, a lowercase hex `sha256` and
`representation: "original"`. Directly owned `inst/*` originals are supported. Materialized
provider files and previews need their own qualification and are refused.

- Work verifies the actual bytes and freezes the purpose, target and complete membership under
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
previews carry the PREVIEW pattern while the work is unapproved. That link to approval state is
not built yet, and approval chains do not yet bind ordinary tool exports to reviewed final
bytes. What each watermark setting does today is in [the enforce
block](governance.md#the-enforce-block).

## Related

- Who can approve: [Roles and grants](permissions.md)
- Binding a chain to a tool: [governance](governance.md)
- Exporting chains as code: [governance](governance.md#policy-as-code)
