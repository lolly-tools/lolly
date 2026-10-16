# Approvals

Chains, not graphs. An approval chain is an ordered list of steps; each step identifies an
eligible team by group and a completion rule. There is no BPM engine, no DAG, no parallel
branch - the shape that matches how a Marketing → Legal review actually runs.

![The approvals inbox - requests routed to your groups, and the ones you raised](shots/approvals-inbox.svg)

## Chains

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
    { "name": "Marketing", "approvers": { "groups": ["marketing-leads"] }, "rule": "any" },
    { "name": "Legal",     "approvers": { "groups": ["legal"] },           "rule": { "quorum": 2 } }
  ],
  "onReject": "return-to-submitter"
}
```

| Rule | Clears the step when |
|---|---|
| `any` | one eligible approver approves |
| `{ quorum: n }` | `n` **distinct** approvers approve |
| `all` | every **nominee named at submit** has approved; with no nominees it behaves as `any` |

Chains bind to work in two places today: catalog submissions go through the chain
`policy.submit.chain` names ([catalog](catalog.md)), and any other approval identifies its
`chainId` when it is raised. The overlay key `enforce.escalation` is declared in the type
but the overlay write paths do not accept it yet - see [status](status.md).

## Raising and acting

```
POST /api/v1/approvals              # subjectType, subjectRef, title, chainId, nominees?
GET  /api/v1/approvals              # filtered to what the caller may see
GET  /api/v1/approvals/approvers    # who is eligible for a step, for nomination
POST /api/v1/approvals/:id/act      # { action: 'approve' | 'reject', comment? }
POST /api/v1/approvals/:id/withdraw
```

Subjects are `asset`, `tool-change`, `config` or `guest-link` - one engine, several kinds of
thing to approve.

The chain is **snapshotted at submit**: an approval is judged by the rules it was raised
under, so editing a chain never rewrites decisions already in flight.

States: `in_review` → `approved` | `rejected` | `withdrawn` (a stepless chain approves at
once). Acting requires `approval.act` and membership of the step's approver groups,
subject to the separation-of-duties rules below. A custom reviewer group does not
automatically receive that permission; assign the approver role or an explicit grant.

## Invariants the engine enforces

These are enforced in code and covered by property tests, not merely documented:

- **Separation of duties.** The submitter can *never* satisfy a step - checked before
  eligibility, so they always get the specific reason (`SEPARATION_OF_DUTIES`).
- **Eligibility by group.** An actor's groups must intersect the step's approver groups
  (`NOT_ELIGIBLE`). Nomination is routing and notification, not exclusivity: any eligible
  team member may act; nominees just get pinged.
- **No step is skippable.** A step completes per its rule, then the index advances; only past
  the last step is the whole approval `approved`.
- **A reject is terminal.** `onReject: 'return-to-submitter'` means the submitter opens a
  *new* approval - there is no resume.

## Notification

Acting on an approval writes to the per-user inbox, so the approver's next shell poll (and
the console's Approvals view) shows what needs them. The console's overview surfaces
"what needs me" from the same source, and messages/inbox targeting is described in
[api](api.md).

## Watermarking preview output

The **Approval chains** console page edits ordered groups and any/quorum/all rules, moves
steps, and previews aggregate reviewer counts. Editing requires `policy.edit`. Preview
excludes disabled accounts, applies `approval.act` grants and denies, and reports counts
excluding the operator because a requester cannot review their own work. It is a chain
preview, not a guarantee for every subject-specific grant or later nomination. Chain saves
advance the version; existing requests keep their submitted snapshot.

Both generic and catalog review actions require `approval.act` as well as group
eligibility and separation of duties. Nomination choices, new nominations, notifications
and the generic inbox also respect effective permissions. A custom reviewer group whose
members have the member role needs an explicit allow grant, for example `approval.act`
on `chain:brand-review`. A deny still wins. Review-chain configuration does not bind
ordinary tool exports to reviewed final bytes; that export workflow remains pending.

An overlay can set `enforce.watermark: 'until-approved'`, which is the intended pairing with
a chain: previews carry the diagonal PREVIEW brick pattern while the work is unapproved.
Today the compositor knows only "watermark now" vs "don't": `always` is enforced, the
per-render *until-approved* linkage to approval state is deliberately not yet wired, and
`never` is stored but behaves the same as unset. See [sharing](sharing.md) and
[status](status.md).

## Related

- Who can approve: [permissions](permissions.md)
- Binding a chain to a tool: [governance](governance.md)
- Exporting chains as code: [governance](governance.md#policy-as-code)
